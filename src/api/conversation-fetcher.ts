import type { ChatGptClient } from "../client/interface.js";
import type { ConversationDetail } from "../types.js";
import {
  buildConversationDetailUrl,
  buildFileDownloadUrl,
  buildHeaders,
  extractAssetReferences,
  parseFileDownload,
} from "./endpoints.js";

export interface ResolvedAsset {
  fileId: string;
  downloadUrl: string;
  fileName: string;
}

export interface FetchConversationResult {
  detail: ConversationDetail;
  assets: ResolvedAsset[];
}

export async function fetchConversation(
  client: ChatGptClient,
  id: string,
  token: string
): Promise<FetchConversationResult> {
  const headers = buildHeaders(token);

  const detailResponse = await client.fetch({
    url: buildConversationDetailUrl(id),
    method: "GET",
    headers,
  });

  const detail: ConversationDetail = JSON.parse(detailResponse.body);

  if (!detail.mapping) {
    throw new Error(`Conversation ${id} not found or has no mapping`);
  }

  const refs = extractAssetReferences(id, detail.mapping);

  const assets: ResolvedAsset[] = [];
  for (const ref of refs) {
    const downloadResponse = await client.fetch({
      url: buildFileDownloadUrl(ref.fileId),
      method: "GET",
      headers,
    });

    const parsed = parseFileDownload(JSON.parse(downloadResponse.body));
    // file_name can be null from the API; fall back to fileId-based name
    const fileName = parsed.file_name || `${ref.fileId}`;
    assets.push({
      fileId: ref.fileId,
      downloadUrl: parsed.download_url,
      fileName,
    });
  }

  return { detail, assets };
}
