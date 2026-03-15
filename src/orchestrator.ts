import type { ChatGptClient } from "./client/interface.js";
import type { ExportManifest, ExportOptions } from "./types.js";
import { listAllConversations } from "./api/conversation-lister.js";
import { fetchConversation } from "./api/conversation-fetcher.js";
import { loadManifest, saveManifest, markConversation } from "./persistence/manifest.js";
import { writeConversation, writeAsset } from "./persistence/file-writer.js";

export async function runExport(
  client: ChatGptClient,
  token: string,
  options: ExportOptions,
): Promise<ExportManifest> {
  const { outputDir, includeAssets, maxConsecutiveErrors, onProgress } = options;

  // 1. Load existing manifest or create a fresh one
  let manifest: ExportManifest = (await loadManifest(outputDir)) ?? {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations: {},
  };

  // 2. List all conversations
  const allConversations = await listAllConversations(client, {
    token,
    includeArchived: options.includeArchived,
    includeProjects: options.includeProjects,
  });

  // 3. Initialize manifest entries for any new conversations
  for (const conv of allConversations) {
    if (!manifest.conversations[conv.id]) {
      manifest = markConversation(manifest, conv.id, {
        id: conv.id,
        title: conv.title,
        status: "pending",
        assetCount: 0,
      });
    }
  }

  // 4. Process each pending conversation
  const pendingIds = allConversations
    .map((c) => c.id)
    .filter((id) => manifest.conversations[id]?.status !== "complete");

  const total = pendingIds.length;
  let consecutiveErrors = 0;
  let processed = 0;

  for (const id of pendingIds) {
    try {
      // Fetch conversation detail + assets
      const result = await fetchConversation(client, id, token);

      // Write conversation JSON
      await writeConversation(outputDir, id, JSON.stringify(result.detail, null, 2));

      // Download and write assets if requested
      if (includeAssets && result.assets.length > 0) {
        for (const asset of result.assets) {
          const assetResponse = await client.fetch({
            url: asset.downloadUrl,
            method: "GET",
            headers: {},
          });
          await writeAsset(outputDir, id, asset.fileName, Buffer.from(assetResponse.body));
        }
      }

      // Mark complete
      manifest = markConversation(manifest, id, {
        status: "complete",
        assetCount: result.assets.length,
      });

      consecutiveErrors = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      manifest = markConversation(manifest, id, {
        status: "error",
        error: message,
      });

      consecutiveErrors++;
      if (consecutiveErrors >= maxConsecutiveErrors) {
        // Save manifest before throwing
        await saveManifest(outputDir, manifest);
        throw new Error(
          `Export aborted: ${maxConsecutiveErrors} consecutive errors. Last error: ${message}`,
        );
      }
    }

    // Save manifest after each conversation
    await saveManifest(outputDir, manifest);

    // Report progress
    processed++;
    onProgress?.(processed, total);
  }

  return manifest;
}
