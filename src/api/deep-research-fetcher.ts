import type { ChatGptClient } from "../client/interface.js";
import type { MessageNode } from "../types.js";
import { buildHeaders } from "./endpoints.js";

export interface DeepResearchRef {
  parentConversationId: string;
  messageId: string;
  sessionId: string;
}

/**
 * Scan a conversation's mapping for deep research async task references.
 * Returns refs needed to fetch results via call_mcp.
 */
export function extractDeepResearchRefs(
  parentConversationId: string,
  mapping: Record<string, MessageNode>,
): DeepResearchRef[] {
  const seen = new Set<string>();
  const refs: DeepResearchRef[] = [];

  for (const node of Object.values(mapping)) {
    if (!node.message) continue;

    const sdk = node.message.metadata?.chatgpt_sdk as
      | { tool_response_metadata?: { async_task_conversation_id?: string | null } }
      | undefined;

    const sessionId = sdk?.tool_response_metadata?.async_task_conversation_id;
    if (typeof sessionId === "string" && sessionId && !seen.has(sessionId)) {
      seen.add(sessionId);
      refs.push({
        parentConversationId,
        messageId: node.message.id,
        sessionId,
      });
    }
  }

  return refs;
}

/**
 * Fetch deep research result via POST /backend-api/ecosystem/call_mcp.
 */
export async function fetchDeepResearchResult(
  client: ChatGptClient,
  token: string,
  ref: DeepResearchRef,
): Promise<unknown> {
  const headers = {
    ...buildHeaders(token),
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    app_uri: "connectors://connector_openai_deep_research",
    tool_name: "get_state",
    conversation_id: ref.parentConversationId,
    message_id: ref.messageId,
    tool_input: { session_id: ref.sessionId },
  });

  const response = await client.fetch({
    url: "/backend-api/ecosystem/call_mcp",
    method: "POST",
    headers,
    body,
  });

  return JSON.parse(response.body);
}
