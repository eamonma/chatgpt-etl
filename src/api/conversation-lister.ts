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
  }

  return all;
}

async function fetchProjectConversations(
  client: ChatGptClient,
  headers: Record<string, string>,
): Promise<ConversationSummary[]> {
  const url = buildProjectSidebarUrl();
  const res = await client.fetch({ url, method: "GET", headers });
  const data: SidebarResponse = JSON.parse(res.body);

  return data.items.map((item) => item.gizmo.conversation);
}

export async function listAllConversations(
  client: ChatGptClient,
  options: ListConversationsOptions,
): Promise<ConversationSummary[]> {
  const headers = buildHeaders(options.token);
  const seen = new Set<string>();
  const result: ConversationSummary[] = [];

  function addUnique(items: ConversationSummary[]): void {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }

  // Fetch regular conversations
  const regular = await paginateConversations(client, buildConversationListUrl, headers);
  addUnique(regular);

  // Fetch archived conversations if requested
  if (options.includeArchived) {
    const archived = await paginateConversations(client, buildArchivedConversationListUrl, headers);
    addUnique(archived);
  }

  // Fetch project conversations if requested
  if (options.includeProjects) {
    const projects = await fetchProjectConversations(client, headers);
    addUnique(projects);
  }

  return result;
}
