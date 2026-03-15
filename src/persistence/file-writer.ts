import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";

async function writeIfChanged(filePath: string, data: Buffer | string): Promise<void> {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;

  try {
    const existing = await readFile(filePath);
    if (existing.equals(buf)) {
      // Identical content — skip write for idempotency
      return;
    }
  } catch {
    // File does not exist yet — proceed with write
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, buf);
}

export async function writeConversation(
  outputDir: string,
  id: string,
  data: string,
): Promise<void> {
  const filePath = join(outputDir, "conversations", `${id}.json`);
  await writeIfChanged(filePath, data);
}

export async function writeAsset(
  outputDir: string,
  conversationId: string,
  fileName: string,
  data: Buffer,
): Promise<void> {
  const filePath = join(outputDir, "assets", conversationId, fileName);
  await writeIfChanged(filePath, data);
}

export async function writeDeepResearchResult(
  outputDir: string,
  parentId: string,
  sessionId: string,
  data: unknown,
): Promise<void> {
  const filePath = join(outputDir, "conversations", `${parentId}.deep-research-${sessionId}.json`);
  await writeIfChanged(filePath, JSON.stringify(data, null, 2));
}

/** Write an index mapping fileId → fileName for a conversation's assets. */
export async function writeAssetIndex(
  outputDir: string,
  conversationId: string,
  assets: { fileId: string; fileName: string }[],
): Promise<void> {
  if (assets.length === 0) return;
  const index: Record<string, string> = {};
  for (const a of assets) {
    index[a.fileId] = a.fileName;
  }
  const filePath = join(outputDir, "assets", conversationId, "_index.json");
  await writeIfChanged(filePath, JSON.stringify(index, null, 2));
}
