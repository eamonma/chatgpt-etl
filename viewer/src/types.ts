export interface ManifestConversation {
  id: string;
  title: string;
  status: "pending" | "complete" | "error";
  error?: string;
  assetCount: number;
}

export interface ExportManifest {
  version: number;
  exportedAt: string;
  conversations: Record<string, ManifestConversation>;
}

export interface ConversationIndexEntry {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
}

/**
 * Minimal type for a full conversation JSON file.
 * Extend as needed when building the detail view.
 */
export interface ConversationFile {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, unknown>;
  [key: string]: unknown;
}
