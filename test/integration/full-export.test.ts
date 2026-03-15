import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MockClient } from "../helpers/mock-client.js";
import { runExport } from "../../src/orchestrator.js";
import type { ExportManifest, ExportOptions } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeConversationListPage(items: { id: string; title: string }[]) {
  return JSON.stringify({
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      create_time: 1700000000,
      update_time: 1700001000,
    })),
  });
}

const emptyPage = JSON.stringify({ items: [] });

function makeDetail(
  id: string,
  title: string,
  mapping: Record<string, unknown> = {},
) {
  return JSON.stringify({
    id,
    title,
    create_time: 1700000000,
    update_time: 1700001000,
    mapping,
    moderation_results: [],
    current_node: "root",
  });
}

/** Build a detail response whose mapping contains a sediment asset reference. */
function makeDetailWithAsset(
  id: string,
  title: string,
  fileId: string,
) {
  return makeDetail(id, title, {
    "node-1": {
      id: "node-1",
      message: {
        id: "msg-1",
        author: { role: "assistant" },
        create_time: 1700000000,
        update_time: 1700001000,
        content: {
          content_type: "multimodal_text",
          parts: [
            "Hello, here is a file:",
            {
              content_type: "image_asset_pointer",
              asset_pointer: `sediment://${fileId}`,
            },
          ],
        },
        metadata: {},
      },
      parent: null,
      children: [],
    },
  });
}

function defaultOptions(
  outputDir: string,
  overrides?: Partial<ExportOptions>,
): ExportOptions {
  return {
    outputDir,
    includeArchived: false,
    includeProjects: false,
    includeAssets: true,
    maxConsecutiveErrors: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("integration: full export pipeline", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "integration-export-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // Test 1: Full export with multi-page listing, conversations with and
  //         without assets. Verify directory structure, manifest
  //         completeness, and parseable files.
  // -----------------------------------------------------------------------
  it("exports multi-page conversation list with assets and produces correct directory structure", async () => {
    // Page 1: conv-a (has asset), conv-b (no asset)
    // Page 2: conv-c (no asset)
    // Page 3: empty (signals end)
    const page1 = [
      { id: "conv-a", title: "Conversation A" },
      { id: "conv-b", title: "Conversation B" },
    ];
    const page2 = [{ id: "conv-c", title: "Conversation C" }];

    let listCallCount = 0;
    const client = new MockClient([
      // Conversation list pagination
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: {
          response: () => {
            listCallCount++;
            if (listCallCount === 1) {
              return { status: 200, headers: {}, body: makeConversationListPage(page1) };
            }
            if (listCallCount === 2) {
              return { status: 200, headers: {}, body: makeConversationListPage(page2) };
            }
            return { status: 200, headers: {}, body: emptyPage };
          },
        },
      },
      // conv-a detail — has an asset (file_img001)
      {
        pattern: /backend-api\/conversation\/conv-a$/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: makeDetailWithAsset("conv-a", "Conversation A", "file_img001"),
          },
        },
      },
      // conv-b detail — plain, no assets
      {
        pattern: /backend-api\/conversation\/conv-b$/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: makeDetail("conv-b", "Conversation B"),
          },
        },
      },
      // conv-c detail — plain, no assets
      {
        pattern: /backend-api\/conversation\/conv-c$/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: makeDetail("conv-c", "Conversation C"),
          },
        },
      },
      // File download metadata for file_img001
      {
        pattern: /backend-api\/files\/download\/file_img001/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: JSON.stringify({
              download_url: "https://cdn.example.com/files/photo.png",
              file_name: "photo.png",
              status: "success",
              metadata: {},
            }),
          },
        },
      },
      // Actual asset binary download
      {
        pattern: "cdn.example.com/files/photo.png",
        handler: {
          response: {
            status: 200,
            headers: {},
            body: "FAKE_PNG_BINARY_DATA",
          },
        },
      },
    ]);

    const progressCalls: Array<[number, number]> = [];
    const manifest = await runExport(
      client,
      "test-token",
      defaultOptions(tmpDir, {
        onProgress: (cur, tot) => progressCalls.push([cur, tot]),
      }),
    );

    // --- Verify manifest completeness ---
    expect(manifest.version).toBe(1);
    expect(manifest.exportedAt).toBeTruthy();
    expect(Object.keys(manifest.conversations)).toHaveLength(3);

    for (const id of ["conv-a", "conv-b", "conv-c"]) {
      expect(manifest.conversations[id].status).toBe("complete");
      expect(manifest.conversations[id].id).toBe(id);
    }

    // conv-a should have 1 asset, others 0
    expect(manifest.conversations["conv-a"].assetCount).toBe(1);
    expect(manifest.conversations["conv-b"].assetCount).toBe(0);
    expect(manifest.conversations["conv-c"].assetCount).toBe(0);

    // --- Verify manifest.json on disk ---
    const manifestOnDisk: ExportManifest = JSON.parse(
      await readFile(join(tmpDir, "manifest.json"), "utf8"),
    );
    expect(manifestOnDisk.conversations["conv-a"].status).toBe("complete");
    expect(manifestOnDisk.conversations["conv-b"].status).toBe("complete");
    expect(manifestOnDisk.conversations["conv-c"].status).toBe("complete");

    // --- Verify conversation JSON files ---
    const conversationsDir = join(tmpDir, "conversations");
    const convFiles = await readdir(conversationsDir);
    expect(convFiles.sort()).toEqual(["conv-a.json", "conv-b.json", "conv-c.json"]);

    for (const id of ["conv-a", "conv-b", "conv-c"]) {
      const raw = await readFile(join(conversationsDir, `${id}.json`), "utf8");
      const parsed = JSON.parse(raw);
      expect(parsed.id).toBe(id);
      expect(parsed.mapping).toBeDefined();
      expect(parsed.moderation_results).toBeDefined();
    }

    // --- Verify asset files ---
    const assetsDir = join(tmpDir, "assets");
    const assetConvDirs = await readdir(assetsDir);
    expect(assetConvDirs).toEqual(["conv-a"]);

    const assetFiles = await readdir(join(assetsDir, "conv-a"));
    expect(assetFiles).toEqual(["photo.png"]);

    const assetContent = await readFile(join(assetsDir, "conv-a", "photo.png"), "utf8");
    expect(assetContent).toBe("FAKE_PNG_BINARY_DATA");

    // --- Verify progress callbacks ---
    expect(progressCalls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);

    // --- Verify pagination: list endpoint called 3 times (page1, page2, empty) ---
    expect(listCallCount).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Test 2: Resume — set one conversation back to "pending" in manifest,
  //         re-run, verify only that one is re-fetched.
  // -----------------------------------------------------------------------
  it("re-exports only pending conversations when resuming from existing manifest", async () => {
    // --- First run: export conv-a and conv-b ---
    let listCallCount = 0;
    const makeListHandler = () => ({
      response: () => {
        listCallCount++;
        if (listCallCount % 2 === 1) {
          return {
            status: 200,
            headers: {},
            body: makeConversationListPage([
              { id: "conv-a", title: "Conversation A" },
              { id: "conv-b", title: "Conversation B" },
            ]),
          };
        }
        return { status: 200, headers: {}, body: emptyPage };
      },
    });

    const client = new MockClient([
      {
        pattern: /backend-api\/conversations\?offset=\d+&limit=100&order=updated$/,
        handler: makeListHandler(),
      },
      {
        pattern: /backend-api\/conversation\/conv-a$/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: makeDetail("conv-a", "Conversation A"),
          },
        },
      },
      {
        pattern: /backend-api\/conversation\/conv-b$/,
        handler: {
          response: {
            status: 200,
            headers: {},
            body: makeDetail("conv-b", "Conversation B"),
          },
        },
      },
    ]);

    // First export
    const manifest1 = await runExport(client, "test-token", defaultOptions(tmpDir));
    expect(manifest1.conversations["conv-a"].status).toBe("complete");
    expect(manifest1.conversations["conv-b"].status).toBe("complete");

    // Verify both conversation details were fetched
    expect(client.getCallCount(/backend-api\/conversation\/conv-a/)).toBe(1);
    expect(client.getCallCount(/backend-api\/conversation\/conv-b/)).toBe(1);

    // --- Manually set conv-b back to "pending" in the manifest ---
    const manifestPath = join(tmpDir, "manifest.json");
    const savedManifest: ExportManifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    );
    savedManifest.conversations["conv-b"].status = "pending";
    await writeFile(manifestPath, JSON.stringify(savedManifest, null, 2), "utf8");

    // --- Reset mock call counts and re-run ---
    client.reset();

    const manifest2 = await runExport(client, "test-token", defaultOptions(tmpDir));

    // Both should be complete after re-run
    expect(manifest2.conversations["conv-a"].status).toBe("complete");
    expect(manifest2.conversations["conv-b"].status).toBe("complete");

    // conv-a should NOT have been re-fetched (already complete)
    expect(client.getCallCount(/backend-api\/conversation\/conv-a$/)).toBe(0);

    // conv-b SHOULD have been re-fetched (was set back to pending)
    expect(client.getCallCount(/backend-api\/conversation\/conv-b$/)).toBe(1);

    // The list endpoint should still be called (to discover conversations)
    expect(client.getCallCount(/backend-api\/conversations\?/)).toBeGreaterThan(0);
  });
});
