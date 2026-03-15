import type { ChatGptClient } from "../client/interface.js";
import type { ConversationSummary } from "../types.js";
import {
  buildConversationListUrl,
  buildArchivedConversationListUrl,
  buildProjectSidebarUrl,
  buildHeaders,
  parseConversationList,
} from "./endpoints.js";

export interface ListConversationsOptions {
  token: string;
  includeArchived?: boolean;
  includeProjects?: boolean;
  limit?: number;
}

interface SidebarItem {
  gizmo: {
    id: string;
    conversation: ConversationSummary;
  };
}

interface SidebarResponse {
  items: SidebarItem[];
}

async function paginateConversations(
  client: ChatGptClient,
  urlBuilder: (offset: number) => string,
  headers: Record<string, string>,
  limit?: number,
): Promise<ConversationSummary[]> {
  const all: ConversationSummary[] = [];
  let offset = 0;

  while (true) {
    const url = urlBuilder(offset);
    const res = await client.fetch({ url, method: "GET", headers });
    const parsed = parseConversationList(JSON.parse(res.body));

    if (parsed.done) {
      break;
    }

    all.push(...parsed.items);
    offset += parsed.items.length;

    if (limit != null && all.length >= limit) {
      break;
    }
  }

  return limit != null ? all.slice(0, limit) : all;
}

async function fetchProjectConversations(
  client: ChatGptClient,
  headers: Record<string, string>,
): Promise<ConversationSummary[]> {
  const url = buildProjectSidebarUrl();
  const res = await client.fetch({ url, method: "GET", headers });
  const data = JSON.parse(res.body);

  // The sidebar response shape was guessed during planning.
  // Log and handle gracefully if it doesn't match.
  if (!data.items || !Array.isArray(data.items)) {
    console.error("[chatgpt-etl] Unexpected sidebar response shape:", JSON.stringify(data).substring(0, 500));
    return [];
  }

  const results: ConversationSummary[] = [];
  for (const item of data.items) {
    // Try known paths: item.gizmo.conversation or item.conversation
    const conv = item?.gizmo?.conversation ?? item?.conversation;
    if (conv && conv.id) {
      results.push(conv);
    }
  }

  return results;
}

export async function listAllConversations(
  client: ChatGptClient,
  options: ListConversationsOptions,
): Promise<ConversationSummary[]> {
  const headers = buildHeaders(options.token);
  const limit = options.limit;
  const seen = new Set<string>();
  const result: ConversationSummary[] = [];

  function addUnique(items: ConversationSummary[]): boolean {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
        if (limit != null && result.length >= limit) {
          return true; // reached limit
        }
      }
    }
    return false;
  }

  // Fetch regular conversations (stop early if limit reached)
  const regular = await paginateConversations(client, buildConversationListUrl, headers, limit);
  if (addUnique(regular)) return result;

  // Fetch archived conversations if requested
  if (options.includeArchived) {
    const remaining = limit != null ? limit - result.length : undefined;
    if (remaining === undefined || remaining > 0) {
      const archived = await paginateConversations(client, buildArchivedConversationListUrl, headers, remaining);
      if (addUnique(archived)) return result;
    }
  }

  // Fetch project conversations if requested
  if (options.includeProjects) {
    if (limit == null || result.length < limit) {
      const projects = await fetchProjectConversations(client, headers);
      addUnique(projects);
    }
  }

  return result;
}
