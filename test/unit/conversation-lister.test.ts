import { describe, it, expect } from "vitest";
import { MockClient } from "../helpers/mock-client.js";
import { listAllConversations } from "../../src/api/conversation-lister.js";
import type { ConversationSummary } from "../../src/types.js";
import type { FetchRequest, FetchResponse } from "../../src/client/interface.js";

function makeSummary(id: string, title?: string): ConversationSummary {
  return {
    id,
    title: title ?? `Conversation ${id}`,
    create_time: 1700000000,
    update_time: 1700000001,
  };
}

function jsonResponse(body: unknown): FetchResponse {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("listAllConversations", () => {
  const token = "test-token";

  it("paginates through multiple pages until empty", async () => {
    const page0Items = Array.from({ length: 100 }, (_, i) => makeSummary(`p0-${i}`));
    const page1Items = Array.from({ length: 50 }, (_, i) => makeSummary(`p1-${i}`));

    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: page0Items }) },
      },
      {
        pattern: /conversations\?offset=100&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: page1Items }) },
      },
      {
        pattern: /conversations\?offset=150&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [] }) },
      },
    ]);

    const result = await listAllConversations(client, { token });

    expect(result).toHaveLength(150);
    expect(result[0].id).toBe("p0-0");
    expect(result[99].id).toBe("p0-99");
    expect(result[100].id).toBe("p1-0");
    expect(result[149].id).toBe("p1-49");
    expect(client.getCallCount(/conversations\?offset=.*order=updated/)).toBe(3);
  });

  it("merges archived conversations when includeArchived is true", async () => {
    const regularItems = [makeSummary("regular-1"), makeSummary("regular-2")];
    const archivedItems = [makeSummary("archived-1"), makeSummary("archived-2")];

    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: regularItems }) },
      },
      {
        pattern: /conversations\?offset=2&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [] }) },
      },
      {
        pattern: /is_archived=true.*offset=0|offset=0.*is_archived=true/,
        handler: { response: jsonResponse({ items: archivedItems }) },
      },
      {
        pattern: /is_archived=true.*offset=2|offset=2.*is_archived=true/,
        handler: { response: jsonResponse({ items: [] }) },
      },
    ]);

    const result = await listAllConversations(client, { token, includeArchived: true });

    expect(result).toHaveLength(4);
    const ids = result.map((c) => c.id);
    expect(ids).toContain("regular-1");
    expect(ids).toContain("archived-1");
  });

  it("does not fetch archived when includeArchived is false", async () => {
    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [makeSummary("r1")] }) },
      },
      {
        pattern: /conversations\?offset=1&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [] }) },
      },
    ]);

    const result = await listAllConversations(client, { token, includeArchived: false });

    expect(result).toHaveLength(1);
    expect(client.getCallCount(/is_archived/)).toBe(0);
  });

  it("fetches project conversations from sidebar endpoint when includeProjects is true", async () => {
    const regularItems = [makeSummary("regular-1")];
    const sidebarResponse = {
      items: [
        {
          gizmo: {
            id: "project-gizmo-1",
            conversation: { id: "proj-1", title: "Project Conv 1", create_time: 1700000000, update_time: 1700000001 },
          },
        },
        {
          gizmo: {
            id: "project-gizmo-2",
            conversation: { id: "proj-2", title: "Project Conv 2", create_time: 1700000000, update_time: 1700000001 },
          },
        },
      ],
    };

    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: regularItems }) },
      },
      {
        pattern: /conversations\?offset=1&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [] }) },
      },
      {
        pattern: /gizmos\/snorlax\/sidebar/,
        handler: { response: jsonResponse(sidebarResponse) },
      },
    ]);

    const result = await listAllConversations(client, { token, includeProjects: true });

    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.id);
    expect(ids).toContain("regular-1");
    expect(ids).toContain("proj-1");
    expect(ids).toContain("proj-2");
    expect(client.getCallCount(/snorlax\/sidebar/)).toBe(1);
  });

  it("deduplicates by conversation ID", async () => {
    const regularItems = [makeSummary("shared-id", "Regular Title"), makeSummary("unique-regular")];
    const sidebarResponse = {
      items: [
        {
          gizmo: {
            id: "g1",
            conversation: { id: "shared-id", title: "Project Title", create_time: 1700000000, update_time: 1700000001 },
          },
        },
        {
          gizmo: {
            id: "g2",
            conversation: { id: "unique-project", title: "Unique Project", create_time: 1700000000, update_time: 1700000001 },
          },
        },
      ],
    };

    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: regularItems }) },
      },
      {
        pattern: /conversations\?offset=2&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: [] }) },
      },
      {
        pattern: /gizmos\/snorlax\/sidebar/,
        handler: { response: jsonResponse(sidebarResponse) },
      },
    ]);

    const result = await listAllConversations(client, { token, includeProjects: true });

    // shared-id appears in both regular and project lists, should only appear once
    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.id);
    expect(ids.filter((id) => id === "shared-id")).toHaveLength(1);
    // The first occurrence (regular) should win
    const shared = result.find((c) => c.id === "shared-id")!;
    expect(shared.title).toBe("Regular Title");
  });

  it("propagates error on intermediate page", async () => {
    const page0Items = Array.from({ length: 100 }, (_, i) => makeSummary(`p0-${i}`));

    const client = new MockClient([
      {
        pattern: /conversations\?offset=0&limit=100&order=updated(?!.*is_archived)/,
        handler: { response: jsonResponse({ items: page0Items }) },
      },
      {
        pattern: /conversations\?offset=100&limit=100&order=updated(?!.*is_archived)/,
        handler: { error: new Error("Network failure on page 2") },
      },
    ]);

    await expect(listAllConversations(client, { token })).rejects.toThrow("Network failure on page 2");
  });
});
