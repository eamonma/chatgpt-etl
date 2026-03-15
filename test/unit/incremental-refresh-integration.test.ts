import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { MockClient } from "../helpers/mock-client.js";
import type { ConversationSummary } from "../../src/types.js";
import type { FetchResponse } from "../../src/client/interface.js";
import {
  buildLookupFromDisk,
  listNewAndUpdatedConversations,
  type StoredConversationLookup,
} from "../../src/api/incremental-refresh.js";

function makeSummary(
  id: string,
  update_time: number,
  title?: string,
): ConversationSummary {
  return {
    id,
    title: title ?? `Conversation ${id}`,
    create_time: 1700000000,
    update_time,
  };
}

function jsonResponse(body: unknown): FetchResponse {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** Write a minimal conversation JSON file with the given update_time. */
async function writeConversationFile(
  outputDir: string,
  id: string,
  update_time: number,
): Promise<void> {
  const dir = join(outputDir, "conversations");
  await mkdir(dir, { recursive: true });
  const data = { id, title: `Conv ${id}`, update_time, create_time: 1700000000, mapping: {} };
  await writeFile(join(dir, `${id}.json`), JSON.stringify(data));
}

describe("buildLookupFromDisk", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = join(tmpdir(), `chatgpt-etl-test-${randomUUID()}`);
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("returns update_time from saved conversation JSON", async () => {
    await writeConversationFile(outputDir, "conv-1", 1700000100);
    await writeConversationFile(outputDir, "conv-2", 1700000200);

    const lookup = await buildLookupFromDisk(outputDir);

    expect(lookup("conv-1")).toBe(1700000100);
    expect(lookup("conv-2")).toBe(1700000200);
  });

  it("returns null for conversations not on disk", async () => {
    const lookup = await buildLookupFromDisk(outputDir);

    expect(lookup("nonexistent")).toBeNull();
  });

  it("returns null when conversations directory does not exist", async () => {
    // outputDir exists but has no conversations/ subdirectory
    const lookup = await buildLookupFromDisk(outputDir);

    expect(lookup("anything")).toBeNull();
  });
});

describe("listNewAndUpdatedConversations", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = join(tmpdir(), `chatgpt-etl-test-${randomUUID()}`);
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("returns all conversations when none exist on disk", async () => {
    const page0 = [makeSummary("a", 300), makeSummary("b", 200)];

    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: page0 }) },
      },
      {
        pattern: /conversations\?offset=2&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [] }) },
      },
    ]);

    const lookup = await buildLookupFromDisk(outputDir);
    const result = await listNewAndUpdatedConversations(client, "token", lookup);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result[0].status).toBe("new");
    expect(result[1].status).toBe("new");
  });

  it("stops paginating when a full page is all unchanged", async () => {
    // Page 0: 3 new conversations
    const page0 = [
      makeSummary("new-1", 500),
      makeSummary("new-2", 400),
      makeSummary("new-3", 300),
    ];
    // Page 1: 3 conversations all on disk with matching update_time
    const page1 = [
      makeSummary("old-1", 200),
      makeSummary("old-2", 100),
      makeSummary("old-3", 50),
    ];
    // Page 2: should never be reached
    const page2 = [makeSummary("very-old-1", 10)];

    await writeConversationFile(outputDir, "old-1", 200);
    await writeConversationFile(outputDir, "old-2", 100);
    await writeConversationFile(outputDir, "old-3", 50);
    await writeConversationFile(outputDir, "very-old-1", 10);

    const client = new MockClient([
      {
        pattern: /offset=0/,
        handler: { response: jsonResponse({ items: page0 }) },
      },
      {
        pattern: /offset=3/,
        handler: { response: jsonResponse({ items: page1 }) },
      },
      {
        pattern: /offset=6/,
        handler: { response: jsonResponse({ items: page2 }) },
      },
    ]);

    const lookup = await buildLookupFromDisk(outputDir);
    const result = await listNewAndUpdatedConversations(client, "token", lookup);

    // Should return only the 3 new conversations, NOT very-old-1
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(["new-1", "new-2", "new-3"]);
    // Should NOT have fetched page 2
    expect(client.getCallCount(/offset=6/)).toBe(0);
  });

  it("does NOT stop when a page has a mix of unchanged and new/updated", async () => {
    // Page 0: mix of new and unchanged
    const page0 = [
      makeSummary("new-1", 500),
      makeSummary("old-1", 200),  // unchanged
      makeSummary("new-2", 150),  // new, after an unchanged one
    ];
    // Page 1: all unchanged — should stop here
    const page1 = [
      makeSummary("old-2", 100),
      makeSummary("old-3", 50),
    ];
    // Page 2: has a new conversation that we'd miss if we stopped at page 0
    // But we don't stop at page 0 because it has new items — only stop at page 1
    const page2ShouldNotBeReached = [makeSummary("should-not-reach", 5)];

    await writeConversationFile(outputDir, "old-1", 200);
    await writeConversationFile(outputDir, "old-2", 100);
    await writeConversationFile(outputDir, "old-3", 50);

    const client = new MockClient([
      {
        pattern: /offset=0/,
        handler: { response: jsonResponse({ items: page0 }) },
      },
      {
        pattern: /offset=3/,
        handler: { response: jsonResponse({ items: page1 }) },
      },
      {
        pattern: /offset=5/,
        handler: { response: jsonResponse({ items: page2ShouldNotBeReached }) },
      },
    ]);

    const lookup = await buildLookupFromDisk(outputDir);
    const result = await listNewAndUpdatedConversations(client, "token", lookup);

    // Should return new-1 and new-2 (skipping unchanged ones)
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(["new-1", "new-2"]);
    // Should NOT have fetched page 2
    expect(client.getCallCount(/offset=5/)).toBe(0);
  });

  it("includes updated conversations (update_time changed)", async () => {
    const page0 = [
      makeSummary("updated-1", 999),  // was 100 on disk
      makeSummary("unchanged-1", 200),
    ];
    const page1 = [
      makeSummary("unchanged-2", 50),
      makeSummary("unchanged-3", 40),
    ];

    await writeConversationFile(outputDir, "updated-1", 100);  // stale
    await writeConversationFile(outputDir, "unchanged-1", 200);
    await writeConversationFile(outputDir, "unchanged-2", 50);
    await writeConversationFile(outputDir, "unchanged-3", 40);

    const client = new MockClient([
      {
        pattern: /offset=0/,
        handler: { response: jsonResponse({ items: page0 }) },
      },
      {
        pattern: /offset=2/,
        handler: { response: jsonResponse({ items: page1 }) },
      },
    ]);

    const lookup = await buildLookupFromDisk(outputDir);
    const result = await listNewAndUpdatedConversations(client, "token", lookup);

    // Should return only the updated conversation
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("updated-1");
    expect(result[0].status).toBe("updated");
  });

  it("the interleaving scenario: new conv buried after updated conv", async () => {
    // This is THE critical scenario:
    // Day 1: export all
    // Day 2: create conv C
    // Day 3: update conv B (existing)
    // Day 4: create conv D
    //
    // API returns (ordered by update_time desc):
    //   D (new, day 4), B (updated, day 3), C (new, day 2), A (unchanged, day 1)
    //
    // We must NOT stop at B just because it's in the manifest.
    // We should keep going until a full page is unchanged.

    const page0 = [
      makeSummary("D", 400),  // new
      makeSummary("B", 300),  // updated (was 100)
      makeSummary("C", 200),  // new
    ];
    const page1 = [
      makeSummary("A", 100),  // unchanged
    ];

    await writeConversationFile(outputDir, "A", 100);
    await writeConversationFile(outputDir, "B", 100);  // stale

    const client = new MockClient([
      {
        pattern: /offset=0/,
        handler: { response: jsonResponse({ items: page0 }) },
      },
      {
        pattern: /offset=3/,
        handler: { response: jsonResponse({ items: page1 }) },
      },
      {
        pattern: /offset=4/,
        handler: { response: jsonResponse({ items: [] }) },
      },
    ]);

    const lookup = await buildLookupFromDisk(outputDir);
    const result = await listNewAndUpdatedConversations(client, "token", lookup);

    // Must include D (new), B (updated), and C (new)
    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.id);
    expect(ids).toContain("D");
    expect(ids).toContain("B");
    expect(ids).toContain("C");
    // A should NOT be in the result (unchanged)
    expect(ids).not.toContain("A");
  });
});
