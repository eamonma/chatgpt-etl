import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MockClient } from "../helpers/mock-client.js";
import { runExport } from "../../src/orchestrator.js";
import { saveManifest } from "../../src/persistence/manifest.js";
import type { ExportManifest, ExportOptions } from "../../src/types.js";

// Helper to build a minimal conversation detail JSON body
function makeDetail(id: string, title: string, linkedConversationIds?: string[]) {
  const mapping: Record<string, unknown> = {};
  if (linkedConversationIds) {
    for (let i = 0; i < linkedConversationIds.length; i++) {
      mapping[`tool-node-${i}`] = {
        id: `tool-node-${i}`,
        message: {
          id: `tool-msg-${i}`,
          author: { role: "tool", name: "api_tool.call_tool" },
          create_time: 1000,
          update_time: 2000,
          content: { content_type: "code", parts: [""] },
          metadata: {
            chatgpt_sdk: {
              tool_response_metadata: {
                async_task_conversation_id: linkedConversationIds[i],
              },
            },
          },
        },
        parent: null,
        children: [],
      };
    }
  }
  return JSON.stringify({
    id,
    title,
    create_time: 1000,
    update_time: 2000,
    mapping,
    moderation_results: [],
    current_node: "node-1",
  });
}

// Conversation list response with items
function makeListResponse(items: { id: string; title: string }[]) {
  return JSON.stringify({
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      create_time: 1000,
      update_time: 2000,
    })),
  });
}

// Empty conversation list (signals pagination done)
const emptyListResponse = JSON.stringify({ items: [] });

function defaultOptions(outputDir: string, overrides?: Partial<ExportOptions>): ExportOptions {
  return {
    outputDir,
    includeArchived: false,
    includeProjects: false,
    includeAssets: false,
    maxConsecutiveErrors: 10,
    ...overrides,
  };
}

describe("orchestrator", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orchestrator-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("full export: lists, fetches, writes, produces complete manifest", async () => {
    const convos = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
    ];

    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeListResponse(convos) };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "First") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
    ]);

    const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

    // Manifest has both conversations marked complete
    expect(manifest.conversations["conv-1"].status).toBe("complete");
    expect(manifest.conversations["conv-2"].status).toBe("complete");
    expect(manifest.version).toBe(1);

    // Conversation files written
    const conv1File = await readFile(join(tmpDir, "conversations", "conv-1.json"), "utf8");
    expect(JSON.parse(conv1File).id).toBe("conv-1");

    const conv2File = await readFile(join(tmpDir, "conversations", "conv-2.json"), "utf8");
    expect(JSON.parse(conv2File).id).toBe("conv-2");

    // Manifest saved to disk
    const manifestOnDisk = JSON.parse(await readFile(join(tmpDir, "manifest.json"), "utf8"));
    expect(manifestOnDisk.conversations["conv-1"].status).toBe("complete");
    expect(manifestOnDisk.conversations["conv-2"].status).toBe("complete");
  });

  it("resumability: given manifest with completed conversations, only fetches pending ones", async () => {
    // Pre-save a manifest with conv-1 already complete, conv-2 pending
    const existingManifest: ExportManifest = {
      version: 1,
      exportedAt: "2025-01-01T00:00:00.000Z",
      conversations: {
        "conv-1": { id: "conv-1", title: "First", status: "complete", assetCount: 0 },
        "conv-2": { id: "conv-2", title: "Second", status: "pending", assetCount: 0 },
      },
    };
    await saveManifest(tmpDir, existingManifest);

    const client = new MockClient([
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
    ]);

    const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

    // conv-1 should remain complete, conv-2 should now be complete
    expect(manifest.conversations["conv-1"].status).toBe("complete");
    expect(manifest.conversations["conv-2"].status).toBe("complete");

    // Should NOT have listed conversations (manifest already exists)
    expect(client.getCallCount(/backend-api\/conversations/)).toBe(0);
    // Should NOT have fetched conv-1 detail
    expect(client.getCallCount(/backend-api\/conversation\/conv-1/)).toBe(0);
    // Should have fetched conv-2 detail
    expect(client.getCallCount(/backend-api\/conversation\/conv-2/)).toBe(1);
  });

  it("error tolerance: failed conversation marked 'error', others continue", async () => {
    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return {
                status: 200,
                headers: {},
                body: makeListResponse([
                  { id: "conv-1", title: "First" },
                  { id: "conv-2", title: "Second" },
                ]),
              };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { error: new Error("Network failure") },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
    ]);

    const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

    expect(manifest.conversations["conv-1"].status).toBe("error");
    expect(manifest.conversations["conv-1"].error).toContain("Network failure");
    expect(manifest.conversations["conv-2"].status).toBe("complete");
  });

  it("manifest saved after each conversation completes", async () => {
    let listCallCount = 0;
    // We'll track manifest saves by reading the file after we know conv-1 was processed
    // We use a detail fetch for conv-2 that checks the manifest state
    let manifestAfterConv1: ExportManifest | null = null;

    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return {
                status: 200,
                headers: {},
                body: makeListResponse([
                  { id: "conv-1", title: "First" },
                  { id: "conv-2", title: "Second" },
                ]),
              };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "First") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: {
          response: () => {
            // Before conv-2 detail returns, read the manifest to verify conv-1 was saved
            const raw = readFileSync(join(tmpDir, "manifest.json"), "utf8");
            manifestAfterConv1 = JSON.parse(raw);
            return { status: 200, headers: {}, body: makeDetail("conv-2", "Second") };
          },
        },
      },
    ]);

    await runExport(client, "test-token", defaultOptions(tmpDir));

    // After conv-1 completed (but before conv-2 finished), manifest should show conv-1 complete
    expect(manifestAfterConv1).not.toBeNull();
    expect(manifestAfterConv1!.conversations["conv-1"].status).toBe("complete");
  });

  it("progress callback invoked with current/total", async () => {
    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return {
                status: 200,
                headers: {},
                body: makeListResponse([
                  { id: "conv-1", title: "First" },
                  { id: "conv-2", title: "Second" },
                  { id: "conv-3", title: "Third" },
                ]),
              };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "First") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-3$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-3", "Third") } },
      },
    ]);

    const progressCalls: Array<[number, number]> = [];
    await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, {
        onProgress: (current, total) => progressCalls.push([current, total]),
      }),
    );

    expect(progressCalls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("circuit breaker: export aborts after N consecutive errors", async () => {
    const convos = Array.from({ length: 5 }, (_, i) => ({
      id: `conv-${i}`,
      title: `Conv ${i}`,
    }));

    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeListResponse(convos) };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\//,
        handler: { error: new Error("Server down") },
      },
    ]);

    await expect(
      runExport(client, "test-token", defaultOptions(tmpDir, { maxConsecutiveErrors: 3 })),
    ).rejects.toThrow(/3 consecutive errors/);

    // Should have only attempted 3, not all 5
    expect(client.getCallCount(/backend-api\/conversation\//)).toBe(3);
  });

  it("circuit breaker resets on success", async () => {
    // conv-0 fails, conv-1 succeeds (resets counter), conv-2 fails, conv-3 fails — should NOT trip with max=3
    const convos = [
      { id: "conv-0", title: "Zero" },
      { id: "conv-1", title: "One" },
      { id: "conv-2", title: "Two" },
      { id: "conv-3", title: "Three" },
    ];

    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeListResponse(convos) };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-0$/,
        handler: { error: new Error("fail") },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "One") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { error: new Error("fail") },
      },
      {
        pattern: /backend-api\/conversation\/conv-3$/,
        handler: { error: new Error("fail") },
      },
    ]);

    const manifest = await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, { maxConsecutiveErrors: 3 }),
    );

    expect(manifest.conversations["conv-0"].status).toBe("error");
    expect(manifest.conversations["conv-1"].status).toBe("complete");
    expect(manifest.conversations["conv-2"].status).toBe("error");
    expect(manifest.conversations["conv-3"].status).toBe("error");
  });

  it("limit restricts number of conversations exported", async () => {
    const convos = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
      { id: "conv-3", title: "Third" },
    ];

    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeListResponse(convos) };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "First") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
      {
        pattern: /backend-api\/conversation\/conv-3$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-3", "Third") } },
      },
    ]);

    const manifest = await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, { limit: 2 }),
    );

    // Only 2 conversations should have been fetched
    expect(manifest.conversations["conv-1"].status).toBe("complete");
    expect(manifest.conversations["conv-2"].status).toBe("complete");
    // conv-3 is in the manifest (listed) but still pending (limit reached)
    expect(manifest.conversations["conv-3"].status).toBe("pending");

    // Verify only 2 detail fetches happened
    expect(client.getCallCount(/backend-api\/conversation\//)).toBe(2);
  });

  it("dry run lists conversations and saves manifest without fetching", async () => {
    const convos = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
    ];

    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeListResponse(convos) };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
    ]);

    const manifest = await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, { dryRun: true }),
    );

    // Conversations should be in manifest as pending
    expect(manifest.conversations["conv-1"].status).toBe("pending");
    expect(manifest.conversations["conv-2"].status).toBe("pending");

    // No detail fetches should have happened
    expect(client.getCallCount(/backend-api\/conversation\//)).toBe(0);

    // Manifest should be saved to disk
    const manifestOnDisk = JSON.parse(await readFile(join(tmpDir, "manifest.json"), "utf8"));
    expect(manifestOnDisk.conversations["conv-1"].status).toBe("pending");
    expect(manifestOnDisk.conversations["conv-2"].status).toBe("pending");
  });

  it("delayMs paces requests between conversations", async () => {
    const convos = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
    ];

    let listCallCount = 0;
    const fetchTimestamps: number[] = [];
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeListResponse(convos) };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: {
          response: () => {
            fetchTimestamps.push(Date.now());
            return { status: 200, headers: {}, body: makeDetail("conv-1", "First") };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: {
          response: () => {
            fetchTimestamps.push(Date.now());
            return { status: 200, headers: {}, body: makeDetail("conv-2", "Second") };
          },
        },
      },
    ]);

    await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, { delayMs: 100 }),
    );

    // Both conversations should have been fetched
    expect(fetchTimestamps).toHaveLength(2);

    // The gap between fetches should be at least ~100ms
    const gap = fetchTimestamps[1] - fetchTimestamps[0];
    expect(gap).toBeGreaterThanOrEqual(80); // allow some timing slack
  });

  it("progress callback receives conversation title", async () => {
    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return {
                status: 200,
                headers: {},
                body: makeListResponse([{ id: "conv-1", title: "My Chat" }]),
              };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "My Chat") } },
      },
    ]);

    const progressCalls: Array<[number, number, string]> = [];
    await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, {
        onProgress: (current, total, title) => progressCalls.push([current, total, title]),
      }),
    );

    expect(progressCalls).toEqual([[1, 1, "My Chat"]]);
  });

  it("skips listing when manifest already has conversations", async () => {
    // Pre-save a manifest with 3 conversations, 1 complete, 2 pending
    const existingManifest: ExportManifest = {
      version: 1,
      exportedAt: "2025-01-01T00:00:00.000Z",
      conversations: {
        "conv-1": { id: "conv-1", title: "First", status: "complete", assetCount: 0 },
        "conv-2": { id: "conv-2", title: "Second", status: "pending", assetCount: 0 },
        "conv-3": { id: "conv-3", title: "Third", status: "pending", assetCount: 0 },
      },
    };
    await saveManifest(tmpDir, existingManifest);

    // Client has detail routes but NO list routes — listing should be skipped
    const client = new MockClient([
      {
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
    ]);

    const manifest = await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, { limit: 1 }),
    );

    // Should not have called any list endpoint
    expect(client.getCallCount(/backend-api\/conversations/)).toBe(0);
    // Should have fetched conv-2 (first pending)
    expect(manifest.conversations["conv-2"].status).toBe("complete");
    // conv-3 still pending (limit 1)
    expect(manifest.conversations["conv-3"].status).toBe("pending");
  });

  it("downloads assets when includeAssets is true", async () => {
    const detailWithAsset = JSON.stringify({
      id: "conv-1",
      title: "With Asset",
      create_time: 1000,
      update_time: 2000,
      mapping: {
        "node-1": {
          id: "node-1",
          message: {
            id: "msg-1",
            author: { role: "assistant" },
            create_time: 1000,
            update_time: 2000,
            content: {
              content_type: "multimodal_text",
              parts: [{ content_type: "image_asset_pointer", asset_pointer: "sediment://file_abc123" }],
            },
            metadata: {},
          },
          parent: null,
          children: [],
        },
      },
      moderation_results: [],
      current_node: "node-1",
    });

    let listCallCount = 0;
    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return {
                status: 200,
                headers: {},
                body: makeListResponse([{ id: "conv-1", title: "With Asset" }]),
              };
            }
            return { status: 200, headers: {}, body: emptyListResponse };
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-1$/,
        handler: { response: { status: 200, headers: {}, body: detailWithAsset } },
      },
      {
        pattern: /backend-api\/files\/download\/file_abc123/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: JSON.stringify({
              download_url: "https://cdn.example.com/image.png",
              file_name: "image.png",
              status: "success",
              metadata: {},
            }),
          },
        },
      },
      {
        pattern: "cdn.example.com/image.png",
        handler: {
          response: { status: 200, headers: {}, body: "fake-image-binary-data" },
        },
      },
    ]);

    const manifest = await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, { includeAssets: true }),
    );

    expect(manifest.conversations["conv-1"].status).toBe("complete");
    expect(manifest.conversations["conv-1"].assetCount).toBe(1);

    // Asset file should be written
    const assetContent = await readFile(join(tmpDir, "assets", "conv-1", "image.png"));
    expect(assetContent.toString()).toBe("fake-image-binary-data");
  });

  describe("incremental refresh (refreshList)", () => {
    // Helper to write a conversation JSON file to disk
    async function writeConvFile(dir: string, id: string, update_time: number) {
      const { mkdir, writeFile: wf } = await import("node:fs/promises");
      const convDir = join(dir, "conversations");
      await mkdir(convDir, { recursive: true });
      await wf(
        join(convDir, `${id}.json`),
        JSON.stringify({
          id,
          title: `Conv ${id}`,
          create_time: 1000,
          update_time,
          mapping: {},
          moderation_results: [],
          current_node: "node-1",
        }),
      );
    }

    it("refreshList only fetches new and updated conversations, not unchanged ones", async () => {
      // Setup: manifest has conv-1 and conv-2 as complete
      const existingManifest: ExportManifest = {
        version: 1,
        exportedAt: "2025-01-01T00:00:00.000Z",
        conversations: {
          "conv-1": { id: "conv-1", title: "First", status: "complete", assetCount: 0 },
          "conv-2": { id: "conv-2", title: "Second", status: "complete", assetCount: 0 },
        },
      };
      await saveManifest(tmpDir, existingManifest);

      // Write conversation files to disk with known update_times
      await writeConvFile(tmpDir, "conv-1", 2000); // unchanged
      await writeConvFile(tmpDir, "conv-2", 2000); // will be updated (API says 3000)

      // API returns: conv-3 (new), conv-2 (updated), conv-1 (unchanged)
      const page0 = [
        { id: "conv-3", title: "Third", create_time: 1000, update_time: 4000 },
        { id: "conv-2", title: "Second Updated", create_time: 1000, update_time: 3000 },
        { id: "conv-1", title: "First", create_time: 1000, update_time: 2000 },
      ];

      let listCallCount = 0;
      const client = new MockClient([
        {
          pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: JSON.stringify({ items: page0 }) } },
        },
        {
          // Page 1: all unchanged — triggers early stop
          pattern: /conversations\?offset=3&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: emptyListResponse } },
        },
        {
          pattern: /backend-api\/conversation\/conv-2$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second Updated") } },
        },
        {
          pattern: /backend-api\/conversation\/conv-3$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("conv-3", "Third") } },
        },
      ]);

      const manifest = await runExport(client, "test-token", defaultOptions(tmpDir, { refreshList: true }));

      // conv-1 should remain complete (unchanged, not re-fetched)
      expect(manifest.conversations["conv-1"].status).toBe("complete");
      // conv-2 should be re-fetched and complete
      expect(manifest.conversations["conv-2"].status).toBe("complete");
      // conv-3 should be fetched and complete
      expect(manifest.conversations["conv-3"].status).toBe("complete");

      // Should NOT have fetched conv-1 detail
      expect(client.getCallCount(/backend-api\/conversation\/conv-1/)).toBe(0);
      // Should have fetched conv-2 and conv-3
      expect(client.getCallCount(/backend-api\/conversation\/conv-2/)).toBe(1);
      expect(client.getCallCount(/backend-api\/conversation\/conv-3/)).toBe(1);
    });

    it("refreshList stops pagination early when a full page is unchanged", async () => {
      // Setup: 200 conversations already exported
      const existingManifest: ExportManifest = {
        version: 1,
        exportedAt: "2025-01-01T00:00:00.000Z",
        conversations: {},
      };
      // Create 200 conversations in manifest and on disk
      for (let i = 0; i < 200; i++) {
        const id = `old-${i}`;
        existingManifest.conversations[id] = {
          id,
          title: `Old ${i}`,
          status: "complete",
          assetCount: 0,
        };
        await writeConvFile(tmpDir, id, 1000 + i);
      }
      await saveManifest(tmpDir, existingManifest);

      // API: page 0 has 3 new conversations + 97 unchanged
      const page0Items = [
        { id: "new-1", title: "New 1", create_time: 1000, update_time: 5000 },
        { id: "new-2", title: "New 2", create_time: 1000, update_time: 4000 },
        { id: "new-3", title: "New 3", create_time: 1000, update_time: 3000 },
        ...Array.from({ length: 97 }, (_, i) => ({
          id: `old-${199 - i}`,
          title: `Old ${199 - i}`,
          create_time: 1000,
          update_time: 1000 + (199 - i),
        })),
      ];
      // API: page 1 has 100 unchanged conversations — should trigger early stop
      const page1Items = Array.from({ length: 100 }, (_, i) => ({
        id: `old-${102 - i}`,
        title: `Old ${102 - i}`,
        create_time: 1000,
        update_time: 1000 + (102 - i),
      }));
      // Page 2 should never be reached
      const page2Items = [
        { id: "old-0", title: "Old 0", create_time: 1000, update_time: 1000 },
      ];

      const client = new MockClient([
        {
          pattern: /offset=0/,
          handler: { response: { status: 200, headers: {}, body: JSON.stringify({ items: page0Items }) } },
        },
        {
          pattern: /offset=100/,
          handler: { response: { status: 200, headers: {}, body: JSON.stringify({ items: page1Items }) } },
        },
        {
          pattern: /offset=200/,
          handler: { response: { status: 200, headers: {}, body: JSON.stringify({ items: page2Items }) } },
        },
        {
          pattern: /backend-api\/conversation\/new-1$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("new-1", "New 1") } },
        },
        {
          pattern: /backend-api\/conversation\/new-2$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("new-2", "New 2") } },
        },
        {
          pattern: /backend-api\/conversation\/new-3$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("new-3", "New 3") } },
        },
      ]);

      const manifest = await runExport(client, "test-token", defaultOptions(tmpDir, { refreshList: true }));

      // New conversations should be complete
      expect(manifest.conversations["new-1"].status).toBe("complete");
      expect(manifest.conversations["new-2"].status).toBe("complete");
      expect(manifest.conversations["new-3"].status).toBe("complete");

      // Page 2 should NOT have been fetched (stopped at page 1 — all unchanged)
      expect(client.getCallCount(/offset=200/)).toBe(0);
    });

    it("refreshList on first run (no manifest) falls back to full listing", async () => {
      const convos = [{ id: "conv-1", title: "First" }];

      const client = new MockClient([
        {
          pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: makeListResponse(convos) } },
        },
        {
          pattern: /conversations\?offset=1&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: emptyListResponse } },
        },
        {
          pattern: /backend-api\/conversation\/conv-1$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "First") } },
        },
      ]);

      const manifest = await runExport(client, "test-token", defaultOptions(tmpDir, { refreshList: true }));

      expect(manifest.conversations["conv-1"].status).toBe("complete");
    });
  });

  describe("deep research (call_mcp)", () => {
    it("fetches deep research result via call_mcp and writes to disk", async () => {
      const mcpResponse = {
        _meta: { deep_research_widget_messages: [{ role: "assistant", content: "Research output" }] },
      };

      let listCallCount = 0;
      const client = new MockClient([
        {
          pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
          handler: {
            response: () => {
              listCallCount++;
              if (listCallCount === 1) {
                return { status: 200, headers: {}, body: makeListResponse([{ id: "parent-conv", title: "Deep Research" }]) };
              }
              return { status: 200, headers: {}, body: emptyListResponse };
            },
          },
        },
        {
          pattern: /conversations\?offset=1&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: emptyListResponse } },
        },
        {
          pattern: /backend-api\/conversation\/parent-conv$/,
          handler: {
            response: {
              status: 200,
              headers: {},
              body: makeDetail("parent-conv", "Deep Research", ["session-abc"]),
            },
          },
        },
        {
          pattern: /backend-api\/ecosystem\/call_mcp$/,
          handler: {
            response: {
              status: 200,
              headers: {},
              body: JSON.stringify(mcpResponse),
            },
          },
        },
      ]);

      const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

      // Parent should be complete
      expect(manifest.conversations["parent-conv"].status).toBe("complete");

      // Deep research result should be written to disk
      const drFile = await readFile(
        join(tmpDir, "conversations", "parent-conv.deep-research-session-abc.json"),
        "utf8",
      );
      expect(JSON.parse(drFile)).toEqual(mcpResponse);

      // Should have called call_mcp
      expect(client.getCallCount(/call_mcp/)).toBe(1);

      // Should NOT have tried to fetch session-abc as a regular conversation
      expect(client.getCallCount(/conversation\/session-abc$/)).toBe(0);
    });

    it("fetches multiple deep research results from one conversation", async () => {
      let listCallCount = 0;
      const client = new MockClient([
        {
          pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
          handler: {
            response: () => {
              listCallCount++;
              if (listCallCount === 1) {
                return { status: 200, headers: {}, body: makeListResponse([{ id: "parent", title: "Multi DR" }]) };
              }
              return { status: 200, headers: {}, body: emptyListResponse };
            },
          },
        },
        {
          pattern: /conversations\?offset=1&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: emptyListResponse } },
        },
        {
          pattern: /backend-api\/conversation\/parent$/,
          handler: {
            response: {
              status: 200,
              headers: {},
              body: makeDetail("parent", "Multi DR", ["session-1", "session-2"]),
            },
          },
        },
        {
          pattern: /backend-api\/ecosystem\/call_mcp$/,
          handler: {
            response: {
              status: 200,
              headers: {},
              body: JSON.stringify({ result: "ok" }),
            },
          },
        },
      ]);

      const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

      expect(manifest.conversations["parent"].status).toBe("complete");
      expect(client.getCallCount(/call_mcp/)).toBe(2);

      // Both result files should exist
      const dr1 = await readFile(join(tmpDir, "conversations", "parent.deep-research-session-1.json"), "utf8");
      expect(JSON.parse(dr1)).toEqual({ result: "ok" });
      const dr2 = await readFile(join(tmpDir, "conversations", "parent.deep-research-session-2.json"), "utf8");
      expect(JSON.parse(dr2)).toEqual({ result: "ok" });
    });

    it("conversation without deep research refs works normally", async () => {
      let listCallCount = 0;
      const client = new MockClient([
        {
          pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
          handler: {
            response: () => {
              listCallCount++;
              if (listCallCount === 1) {
                return { status: 200, headers: {}, body: makeListResponse([{ id: "conv-1", title: "Normal" }]) };
              }
              return { status: 200, headers: {}, body: emptyListResponse };
            },
          },
        },
        {
          pattern: /conversations\?offset=1&limit=100&order=updated(?!.*is_archived)/,
          handler: { response: { status: 200, headers: {}, body: emptyListResponse } },
        },
        {
          pattern: /backend-api\/conversation\/conv-1$/,
          handler: { response: { status: 200, headers: {}, body: makeDetail("conv-1", "Normal") } },
        },
      ]);

      const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

      expect(manifest.conversations["conv-1"].status).toBe("complete");
      expect(client.getCallCount(/call_mcp/)).toBe(0);
    });
  });
});
