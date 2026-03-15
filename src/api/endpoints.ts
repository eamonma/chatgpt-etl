import type {
  ConversationSummary,
  MessageNode,
  AssetReference,
} from "../types.js";

// --- URL Builders ---

export function buildConversationListUrl(offset: number): string {
  return `/backend-api/conversations?offset=${offset}&limit=100&order=updated`;
}

export function buildArchivedConversationListUrl(offset: number): string {
  return `/backend-api/conversations?offset=${offset}&limit=100&order=updated&is_archived=true`;
}

export function buildConversationDetailUrl(id: string): string {
  return `/backend-api/conversation/${id}`;
}

export function buildProjectSidebarUrl(): string {
  return "/backend-api/gizmos/snorlax/sidebar";
}

export function buildFileDownloadUrl(fileId: string): string {
  return `/backend-api/files/download/${fileId}?post_id=&inline=false`;
}

// --- Headers ---

export function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "oai-language": "en-US",
  };
}

// --- Response Parsers ---

export interface ConversationListResult {
  items: ConversationSummary[];
  done: boolean;
}

export function parseConversationList(response: {
  items: ConversationSummary[];
  [key: string]: unknown;
}): ConversationListResult {
  const items = response.items;
  return {
    items,
    done: items.length === 0,
  };
}

export function extractAssetReferences(
  conversationId: string,
  mapping: Record<string, MessageNode>
): AssetReference[] {
  const refs: AssetReference[] = [];
  const sedimentPattern = /^sediment:\/\/(file_.+)$/;

  for (const node of Object.values(mapping)) {
    if (!node.message) continue;

    const parts = node.message.content.parts;
    if (!parts) continue;

    for (const part of parts) {
      if (typeof part === "string") continue;
      if (!part.asset_pointer) continue;

      const match = sedimentPattern.exec(part.asset_pointer);
      if (match) {
        refs.push({
          conversationId,
          messageId: node.message.id,
          fileId: match[1],
          pointer: part.asset_pointer,
        });
      }
    }
  }

  return refs;
}

export interface FileDownloadResult {
  download_url: string;
  file_name: string | null;
  status: string;
  metadata: unknown;
}

export function parseFileDownload(response: {
  download_url: string;
  file_name?: string | null;
  status: string;
  metadata: unknown;
}): FileDownloadResult {
  return {
    download_url: response.download_url,
    file_name: response.file_name ?? null,
    status: response.status,
    metadata: response.metadata,
  };
}
