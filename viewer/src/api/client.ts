import type { ExportManifest, ConversationFile } from "../types";

export async function fetchManifest(): Promise<ExportManifest> {
  const res = await fetch("/api/manifest");
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchConversation(id: string): Promise<ConversationFile> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch conversation ${id}: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
}
