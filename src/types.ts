export interface ConversationSummary {
  id: string;
  title: string;
  create_time: string | number;
  update_time: string | number;
  mapping?: Record<string, MessageNode>;
}

export interface ConversationDetail {
  id: string;
  title: string;
  create_time: string | number;
  update_time: string | number;
  mapping: Record<string, MessageNode>;
  moderation_results: unknown[];
  current_node: string;
}

export interface MessageNode {
  id: string;
  message: Message | null;
  parent: string | null;
  children: string[];
}

export interface Message {
  id: string;
  author: { role: string; name?: string; metadata?: Record<string, unknown> };
  create_time: number | null;
  update_time: number | null;
  content: MessageContent;
  metadata: Record<string, unknown>;
}

export interface MessageContent {
  content_type: string;
  parts?: (string | MessagePart)[];
}

export interface MessagePart {
  content_type?: string;
  asset_pointer?: string;
  [key: string]: unknown;
}

export interface AssetReference {
  conversationId: string;
  messageId: string;
  fileId: string;
  pointer: string;
}

export type ConversationExportStatus = "pending" | "complete" | "error";

export interface ManifestConversation {
  id: string;
  title: string;
  status: ConversationExportStatus;
  error?: string;
  assetCount: number;
  /** update_time from the conversation list API, used to detect changes on refresh. */
  updateTime?: number;
}

export interface ExportManifest {
  version: number;
  exportedAt: string;
  conversations: Record<string, ManifestConversation>;
}

export interface ExportOptions {
  outputDir: string;
  includeArchived: boolean;
  includeProjects: boolean;
  includeAssets: boolean;
  maxConsecutiveErrors: number;
  limit?: number;
  dryRun?: boolean;
  refreshList?: boolean;
  delayMs?: number;
  onProgress?: (current: number, total: number, title: string) => void;
}
