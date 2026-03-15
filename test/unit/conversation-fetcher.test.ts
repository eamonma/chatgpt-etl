import { describe, it, expect } from "vitest";
import { MockClient } from "../helpers/mock-client.js";
import { fetchConversation } from "../../src/api/conversation-fetcher.js";
import type { ConversationDetail } from "../../src/types.js";
import conversationDetail from "../fixtures/conversation-detail.json";
import fileDownload from "../fixtures/file-download.json";

const TOKEN = "test-token-abc";

describe("fetchConversation", () => {
  it("fetches conversation detail by ID", async () => {
    const client = new MockClient({
      "/backend-api/conversation/conv-abc-123": {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify(conversationDetail),
        },
      },
    });

    const result = await fetchConversation(client, "conv-abc-123", TOKEN);

    expect(result.detail.id).toBe("conv-abc-123");
    expect(result.detail.title).toBe("My Chat about TypeScript");
    expect(result.detail.mapping).toBeDefined();
    expect(result.detail.current_node).toBe("msg-node-003");
  });

  it("extracts asset references and fetches download URLs", async () => {
    const client = new MockClient({
      "/backend-api/conversation/conv-abc-123": {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify(conversationDetail),
        },
      },
      "/backend-api/files/download/file_abc123": {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({
            status: "success",
            download_url: "https://files.oaiusercontent.com/file_abc123/image.png?sig=aaa",
            file_name: "image.png",
            metadata: {},
          }),
        },
      },
      "/backend-api/files/download/file_def456": {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({
            status: "success",
            download_url: "https://files.oaiusercontent.com/file_def456/doc.pdf?sig=bbb",
            file_name: "doc.pdf",
            metadata: {},
          }),
        },
      },
    });

    const result = await fetchConversation(client, "conv-abc-123", TOKEN);

    expect(result.assets).toHaveLength(2);
    expect(result.assets[0]).toEqual({
      fileId: "file_abc123",
      downloadUrl: "https://files.oaiusercontent.com/file_abc123/image.png?sig=aaa",
      fileName: "image.png",
    });
    expect(result.assets[1]).toEqual({
      fileId: "file_def456",
      downloadUrl: "https://files.oaiusercontent.com/file_def456/doc.pdf?sig=bbb",
      fileName: "doc.pdf",
    });
  });

  it("handles conversations with no assets", async () => {
    const noAssetsDetail: ConversationDetail = {
      id: "conv-no-assets",
      title: "Plain text chat",
      create_time: 1700000000,
      update_time: 1700001000,
      moderation_results: [],
      current_node: "node-2",
      mapping: {
        "node-1": {
          id: "node-1",
          message: null,
          parent: null,
          children: ["node-2"],
        },
        "node-2": {
          id: "node-2",
          message: {
            id: "node-2",
            author: { role: "user" },
            create_time: 1700000100,
            update_time: null,
            content: { content_type: "text", parts: ["Hello world"] },
            metadata: {},
          },
          parent: "node-1",
          children: [],
        },
      },
    };

    const client = new MockClient({
      "/backend-api/conversation/conv-no-assets": {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify(noAssetsDetail),
        },
      },
    });

    const result = await fetchConversation(client, "conv-no-assets", TOKEN);

    expect(result.detail.id).toBe("conv-no-assets");
    expect(result.assets).toEqual([]);
  });
});
