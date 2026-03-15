import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  loadManifest,
  saveManifest,
  markConversation,
} from "../../src/persistence/manifest.js";
import type { ExportManifest, ManifestConversation } from "../../src/types.js";

describe("loadManifest", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "manifest-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when manifest.json does not exist", async () => {
    const result = await loadManifest(tmpDir);
    expect(result).toBeNull();
  });
});

describe("saveManifest and loadManifest", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "manifest-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes valid JSON and reads it back correctly", async () => {
    const manifest: ExportManifest = {
      version: 1,
      exportedAt: "2026-03-14T00:00:00.000Z",
      conversations: {
        "conv-1": {
          id: "conv-1",
          title: "Test Conversation",
          status: "complete",
          assetCount: 3,
        },
      },
    };

    await saveManifest(tmpDir, manifest);
    const loaded = await loadManifest(tmpDir);

    expect(loaded).toEqual(manifest);
  });

  it("overwrites existing manifest atomically", async () => {
    const first: ExportManifest = {
      version: 1,
      exportedAt: "2026-03-14T00:00:00.000Z",
      conversations: {},
    };
    const second: ExportManifest = {
      version: 1,
      exportedAt: "2026-03-14T01:00:00.000Z",
      conversations: {
        "conv-2": {
          id: "conv-2",
          title: "Another Conversation",
          status: "pending",
          assetCount: 0,
        },
      },
    };

    await saveManifest(tmpDir, first);
    await saveManifest(tmpDir, second);
    const loaded = await loadManifest(tmpDir);

    expect(loaded).toEqual(second);
  });
});

describe("markConversation", () => {
  const baseManifest: ExportManifest = {
    version: 1,
    exportedAt: "2026-03-14T00:00:00.000Z",
    conversations: {
      "conv-1": {
        id: "conv-1",
        title: "First Conversation",
        status: "pending",
        assetCount: 0,
      },
      "conv-2": {
        id: "conv-2",
        title: "Second Conversation",
        status: "pending",
        assetCount: 0,
      },
    },
  };

  it("updates the status of a conversation immutably", () => {
    const updated = markConversation(baseManifest, "conv-1", {
      status: "complete",
      assetCount: 5,
    });

    expect(updated.conversations["conv-1"].status).toBe("complete");
    expect(updated.conversations["conv-1"].assetCount).toBe(5);
    // original is unchanged
    expect(baseManifest.conversations["conv-1"].status).toBe("pending");
    expect(baseManifest.conversations["conv-1"].assetCount).toBe(0);
  });

  it("does not affect other conversations", () => {
    const updated = markConversation(baseManifest, "conv-1", {
      status: "error",
      error: "Something went wrong",
    });

    expect(updated.conversations["conv-2"]).toEqual(
      baseManifest.conversations["conv-2"]
    );
  });

  it("returns a new object (immutable)", () => {
    const updated = markConversation(baseManifest, "conv-1", {
      status: "complete",
    });

    expect(updated).not.toBe(baseManifest);
    expect(updated.conversations).not.toBe(baseManifest.conversations);
    expect(updated.conversations["conv-1"]).not.toBe(
      baseManifest.conversations["conv-1"]
    );
  });

  it("adds a new conversation entry when id does not exist", () => {
    const newConv: ManifestConversation = {
      id: "conv-3",
      title: "New Conversation",
      status: "pending",
      assetCount: 0,
    };

    const updated = markConversation(baseManifest, "conv-3", newConv);

    expect(updated.conversations["conv-3"]).toEqual(newConv);
    expect(Object.keys(updated.conversations)).toHaveLength(3);
  });
});
