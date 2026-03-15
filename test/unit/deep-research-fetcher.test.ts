import { describe, it, expect } from "vitest";
import { extractDeepResearchRefs, fetchDeepResearchResult } from "../../src/api/deep-research-fetcher.js";
import { MockClient } from "../helpers/mock-client.js";
import type { MessageNode } from "../../src/types.js";

function makeNode(overrides: {
  id?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}): MessageNode {
  const { id = "node-1", role = "tool", metadata = {} } = overrides;
  return {
    id,
    message: {
      id: `msg-${id}`,
      author: { role },
      create_time: 1000,
      update_time: 2000,
      content: { content_type: "text", parts: [""] },
      metadata,
    },
    parent: null,
    children: [],
  };
}

describe("extractDeepResearchRefs", () => {
  it("extracts async_task_conversation_id with parent and message context", () => {
    const mapping: Record<string, MessageNode> = {
      "node-1": makeNode({
        id: "tool-node",
        metadata: {
          chatgpt_sdk: {
            tool_response_metadata: {
              async_task_conversation_id: "session-abc",
            },
          },
        },
      }),
    };

    const refs = extractDeepResearchRefs("parent-conv-id", mapping);
    expect(refs).toEqual([
      {
        parentConversationId: "parent-conv-id",
        messageId: "msg-tool-node",
        sessionId: "session-abc",
      },
    ]);
  });

  it("returns empty array when no deep research refs exist", () => {
    const mapping: Record<string, MessageNode> = {
      "node-1": makeNode({ metadata: {} }),
    };
    expect(extractDeepResearchRefs("parent", mapping)).toEqual([]);
  });

  it("deduplicates same session ID across multiple nodes", () => {
    const sdk = {
      chatgpt_sdk: {
        tool_response_metadata: { async_task_conversation_id: "same-session" },
      },
    };
    const mapping: Record<string, MessageNode> = {
      "node-1": makeNode({ id: "n1", metadata: sdk }),
      "node-2": makeNode({ id: "n2", metadata: sdk }),
    };

    const refs = extractDeepResearchRefs("parent", mapping);
    expect(refs).toHaveLength(1);
    expect(refs[0].sessionId).toBe("same-session");
  });

  it("extracts multiple distinct session IDs", () => {
    const mapping: Record<string, MessageNode> = {
      "node-1": makeNode({
        id: "n1",
        metadata: {
          chatgpt_sdk: {
            tool_response_metadata: { async_task_conversation_id: "session-a" },
          },
        },
      }),
      "node-2": makeNode({
        id: "n2",
        metadata: {
          chatgpt_sdk: {
            tool_response_metadata: { async_task_conversation_id: "session-b" },
          },
        },
      }),
    };

    const refs = extractDeepResearchRefs("parent", mapping);
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.sessionId)).toEqual(["session-a", "session-b"]);
  });

  it("skips nodes without messages", () => {
    const mapping: Record<string, MessageNode> = {
      root: { id: "root", message: null, parent: null, children: ["n1"] },
      n1: makeNode({
        id: "n1",
        metadata: {
          chatgpt_sdk: {
            tool_response_metadata: { async_task_conversation_id: "session-1" },
          },
        },
      }),
    };

    const refs = extractDeepResearchRefs("parent", mapping);
    expect(refs).toHaveLength(1);
  });

  it("handles null/missing async_task_conversation_id gracefully", () => {
    const mapping: Record<string, MessageNode> = {
      "node-1": makeNode({ metadata: { chatgpt_sdk: {} } }),
      "node-2": makeNode({ metadata: { chatgpt_sdk: { tool_response_metadata: {} } } }),
      "node-3": makeNode({
        metadata: {
          chatgpt_sdk: { tool_response_metadata: { async_task_conversation_id: null } },
        },
      }),
    };

    expect(extractDeepResearchRefs("parent", mapping)).toEqual([]);
  });
});

describe("fetchDeepResearchResult", () => {
  it("sends correct POST request and returns parsed response", async () => {
    const mcpResponse = {
      _meta: {
        deep_research_widget_messages: [{ role: "assistant", content: "Research result" }],
      },
    };

    const client = new MockClient([
      {
        pattern: /backend-api\/ecosystem\/call_mcp$/,
        handler: {
          response: (req) => {
            // Verify headers
            expect(req.headers["Content-Type"]).toBe("application/json");
            expect(req.headers["Authorization"]).toBe("Bearer test-token");
            expect(req.method).toBe("POST");

            // Verify body
            const body = JSON.parse(req.body!);
            expect(body.app_uri).toBe("connectors://connector_openai_deep_research");
            expect(body.tool_name).toBe("get_state");
            expect(body.conversation_id).toBe("parent-conv");
            expect(body.message_id).toBe("msg-123");
            expect(body.tool_input.session_id).toBe("session-abc");

            return {
              status: 200,
              headers: {},
              body: JSON.stringify(mcpResponse),
            };
          },
        },
      },
    ]);

    const ref = {
      parentConversationId: "parent-conv",
      messageId: "msg-123",
      sessionId: "session-abc",
    };

    const result = await fetchDeepResearchResult(client, "test-token", ref);
    expect(result).toEqual(mcpResponse);
  });
});
