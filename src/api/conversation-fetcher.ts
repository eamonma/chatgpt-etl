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

  const refs = extractAssetReferences(id, detail.mapping);

  const assets: ResolvedAsset[] = [];
  for (const ref of refs) {
    const downloadResponse = await client.fetch({
      url: buildFileDownloadUrl(ref.fileId),
      method: "GET",
      headers,
    });

    const parsed = parseFileDownload(JSON.parse(downloadResponse.body));
    assets.push({
      fileId: ref.fileId,
      downloadUrl: parsed.download_url,
      fileName: parsed.file_name,
    });
  }

  return { detail, assets };
}
