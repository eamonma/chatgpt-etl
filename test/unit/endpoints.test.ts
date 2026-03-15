import { describe, it, expect } from "vitest";
import {
  buildConversationListUrl,
  buildArchivedConversationListUrl,
  buildConversationDetailUrl,
  buildProjectSidebarUrl,
  buildFileDownloadUrl,
  buildHeaders,
  parseConversationList,
  extractAssetReferences,
  parseFileDownload,
} from "../../src/api/endpoints.js";

import conversationListPage from "../fixtures/conversation-list-page.json";
import conversationDetail from "../fixtures/conversation-detail.json";
import fileDownload from "../fixtures/file-download.json";

describe("URL builders", () => {
  it("builds conversation list URL with offset", () => {
    expect(buildConversationListUrl(0)).toBe(
      "/backend-api/conversations?offset=0&limit=100&order=updated"
    );
    expect(buildConversationListUrl(100)).toBe(
      "/backend-api/conversations?offset=100&limit=100&order=updated"
    );
    expect(buildConversationListUrl(200)).toBe(
      "/backend-api/conversations?offset=200&limit=100&order=updated"
    );
  });

  it("builds archived conversation list URL with offset", () => {
    expect(buildArchivedConversationListUrl(0)).toBe(
      "/backend-api/conversations?offset=0&limit=100&order=updated&is_archived=true"
    );
    expect(buildArchivedConversationListUrl(50)).toBe(
      "/backend-api/conversations?offset=50&limit=100&order=updated&is_archived=true"
    );
  });

  it("builds conversation detail URL with id", () => {
    expect(buildConversationDetailUrl("conv-abc-123")).toBe(
      "/backend-api/conversation/conv-abc-123"
    );
  });

  it("builds project sidebar URL", () => {
    expect(buildProjectSidebarUrl()).toBe(
      "/backend-api/gizmos/snorlax/sidebar"
    );
  });

  it("builds file download URL with file id", () => {
    expect(buildFileDownloadUrl("file_abc123")).toBe(
      "/backend-api/files/download/file_abc123?post_id=&inline=false"
    );
  });
});

describe("buildHeaders", () => {
  it("includes Bearer token and oai-language", () => {
    const headers = buildHeaders("my-secret-token");
    expect(headers).toEqual({
      Authorization: "Bearer my-secret-token",
      "oai-language": "en-US",
    });
  });

  it("works with different tokens", () => {
    const headers = buildHeaders("another-token-xyz");
    expect(headers.Authorization).toBe("Bearer another-token-xyz");
    expect(headers["oai-language"]).toBe("en-US");
  });
});

describe("parseConversationList", () => {
  it("extracts conversation items from response", () => {
    const result = parseConversationList(conversationListPage);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({
      id: "conv-abc-123",
      title: "My Chat about TypeScript",
      create_time: 1700000000,
      update_time: 1700001000,
    });
    expect(result.items[2].id).toBe("conv-ghi-789");
  });

  it("detects last page when items is empty", () => {
    const emptyPage = { items: [], total: 1174, limit: 100, offset: 300, has_missing_conversations: false };
    const result = parseConversationList(emptyPage);
    expect(result.items).toHaveLength(0);
    expect(result.done).toBe(true);
  });

  it("is not done when items are present", () => {
    const result = parseConversationList(conversationListPage);
    expect(result.done).toBe(false);
  });

  it("ignores unreliable total field", () => {
    const pageWithBogusTotal = { items: [{ id: "x", title: "X", create_time: 0, update_time: 0 }], total: 0, limit: 100, offset: 0, has_missing_conversations: false };
    const result = parseConversationList(pageWithBogusTotal);
    expect(result.done).toBe(false);
    expect(result.items).toHaveLength(1);
  });
});

describe("extractAssetReferences", () => {
  it("finds sediment://file_{id} patterns in message parts", () => {
    const refs = extractAssetReferences("conv-abc-123", conversationDetail.mapping as any);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({
      conversationId: "conv-abc-123",
      messageId: "msg-node-004",
      fileId: "file_abc123",
      pointer: "sediment://file_abc123",
    });
    expect(refs[1]).toEqual({
      conversationId: "conv-abc-123",
      messageId: "msg-node-004",
      fileId: "file_def456",
      pointer: "sediment://file_def456",
    });
  });

  it("returns empty array when no asset references exist", () => {
    const simpleMapping = {
      "node-1": {
        id: "node-1",
        message: {
          id: "node-1",
          author: { role: "user" },
          create_time: null,
          update_time: null,
          content: { content_type: "text", parts: ["Hello world"] },
          metadata: {},
        },
        parent: null,
        children: [],
      },
    };
    const refs = extractAssetReferences("conv-xyz", simpleMapping as any);
    expect(refs).toEqual([]);
  });

  it("returns empty array for nodes with null messages", () => {
    const mapping = {
      "node-1": {
        id: "node-1",
        message: null,
        parent: null,
        children: [],
      },
    };
    const refs = extractAssetReferences("conv-xyz", mapping as any);
    expect(refs).toEqual([]);
  });
});

describe("parseFileDownload", () => {
  it("extracts download_url from response", () => {
    const result = parseFileDownload(fileDownload);
    expect(result.download_url).toBe(
      "https://files.oaiusercontent.com/file-abc123/image.png?se=2024-01-15&sig=abc"
    );
  });

  it("extracts file_name from response", () => {
    const result = parseFileDownload(fileDownload);
    expect(result.file_name).toBe("image.png");
  });
});
