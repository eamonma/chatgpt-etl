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
function makeDetail(id: string, title: string) {
  return JSON.stringify({
    id,
    title,
    create_time: 1000,
    update_time: 2000,
    mapping: {},
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
    // Pre-save a manifest with conv-1 already complete
    const existingManifest: ExportManifest = {
      version: 1,
      exportedAt: "2025-01-01T00:00:00.000Z",
      conversations: {
        "conv-1": { id: "conv-1", title: "First", status: "complete", assetCount: 0 },
      },
    };
    await saveManifest(tmpDir, existingManifest);

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
        pattern: /backend-api\/conversation\/conv-2$/,
        handler: { response: { status: 200, headers: {}, body: makeDetail("conv-2", "Second") } },
      },
    ]);

    const manifest = await runExport(client, "test-token", defaultOptions(tmpDir));

    // conv-1 should remain complete, conv-2 should now be complete
    expect(manifest.conversations["conv-1"].status).toBe("complete");
    expect(manifest.conversations["conv-2"].status).toBe("complete");

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
});
