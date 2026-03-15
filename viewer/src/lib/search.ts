import type { ManifestConversation, ConversationFile } from "../types";

export interface SearchResult {
  conversationId: string;
  title: string;
  matches: { snippet: string; role: string }[];
}

/**
 * Filter manifest conversations by case-insensitive title match.
 * Returns all conversations if query is empty.
 */
export function searchByTitle(
  conversations: ManifestConversation[],
  query: string
): ManifestConversation[] {
  if (!query) return conversations;
  const lower = query.toLowerCase();
  return conversations.filter((c) => c.title.toLowerCase().includes(lower));
}

/**
 * Search a single conversation's message content for a query string.
 * Walks all mapping nodes and extracts text from "text" and "multimodal_text"
 * content types. Returns snippets with ~50 chars of context around each match.
 * Returns null if no matches found.
 */
export function searchConversationContent(
  conversation: ConversationFile,
  query: string
): SearchResult | null {
  if (!query) return null;

  const lowerQuery = query.toLowerCase();
  const matches: { snippet: string; role: string }[] = [];
  const mapping = conversation.mapping as Record<string, MappingNodeLike>;

  for (const node of Object.values(mapping)) {
    if (!node.message) continue;

    const msg = node.message;
    const contentType = msg.content?.content_type;
    if (contentType !== "text" && contentType !== "multimodal_text") continue;

    const parts = msg.content?.parts;
    if (!Array.isArray(parts)) continue;

    const role = msg.author?.role ?? "unknown";

    for (const part of parts) {
      if (typeof part !== "string") continue;

      const lowerPart = part.toLowerCase();
      const idx = lowerPart.indexOf(lowerQuery);
      if (idx === -1) continue;

      const snippetStart = Math.max(0, idx - 50);
      const snippetEnd = Math.min(part.length, idx + query.length + 50);
      const snippet = part.slice(snippetStart, snippetEnd);

      matches.push({ snippet, role });
    }
  }

  if (matches.length === 0) return null;

  return {
    conversationId: conversation.id,
    title: conversation.title,
    matches,
  };
}

/** Minimal shape we need from a mapping node for search purposes. */
interface MappingNodeLike {
  message: {
    author?: { role: string };
    content?: {
      content_type: string;
      parts?: (string | Record<string, unknown>)[];
    };
  } | null;
}
