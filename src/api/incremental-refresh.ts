import { readFile, readdir } from "fs/promises";
import { join } from "path";
import type { ChatGptClient } from "../client/interface.js";
import type { ConversationSummary } from "../types.js";
import { buildConversationListUrl, buildHeaders, parseConversationList } from "./endpoints.js";

/**
 * Given a conversation ID, returns the stored update_time,
 * or null if the conversation isn't on disk.
 */
export type StoredConversationLookup = (id: string) => string | number | null;

export interface ClassifiedConversation {
  id: string;
  title: string;
  status: "new" | "updated" | "unchanged";
}

export interface ClassifyPageResult {
  conversations: ClassifiedConversation[];
  /** True when every conversation on this page is unchanged — signals pagination can stop. */
  allUnchanged: boolean;
}

/**
 * Classify a page of API results against what's stored on disk.
 *
 * - "new": conversation ID not found on disk
 * - "updated": found on disk but update_time differs
 * - "unchanged": found on disk and update_time matches
 */
export function classifyPage(
  page: ConversationSummary[],
  lookup: StoredConversationLookup,
): ClassifyPageResult {
  if (page.length === 0) {
    return { conversations: [], allUnchanged: false };
  }

  const conversations: ClassifiedConversation[] = [];
  let allUnchanged = true;

  for (const conv of page) {
    const storedUpdateTime = lookup(conv.id);

    let status: ClassifiedConversation["status"];
    if (storedUpdateTime === null) {
      status = "new";
      allUnchanged = false;
    } else if (matchesUpdateTime(storedUpdateTime, conv.update_time)) {
      status = "unchanged";
    } else {
      status = "updated";
      allUnchanged = false;
    }

    conversations.push({ id: conv.id, title: conv.title, status });
  }

  return { conversations, allUnchanged };
}

function matchesUpdateTime(stored: string | number, api: string | number): boolean {
  const storedNum = Number(stored);
  const apiNum = Number(api);

  // Numeric timestamps can have tiny fractional differences between endpoints.
  if (Number.isFinite(storedNum) && Number.isFinite(apiNum)) {
    return Math.floor(storedNum) === Math.floor(apiNum);
  }

  // Some exports may store ISO timestamp strings. Compare raw values in that case.
  return String(stored) === String(api);
}

/**
 * Build a lookup function that reads update_time from saved conversation
 * JSON files on disk. Scans the conversations/ directory once and caches
 * all update_times in memory.
 */
export async function buildLookupFromDisk(
  outputDir: string,
): Promise<StoredConversationLookup> {
  const convDir = join(outputDir, "conversations");
  const cache = new Map<string, string | number>();

  let files: string[];
  try {
    files = await readdir(convDir);
  } catch {
    // Directory doesn't exist — nothing on disk
    return () => null;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(convDir, file), "utf8");
      const data = JSON.parse(raw);
      if (data.id && data.update_time != null) {
        cache.set(data.id, data.update_time);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return (id: string) => cache.get(id) ?? null;
}

/**
 * Paginate the conversation list API, comparing against saved files on disk.
 * Returns only new and updated conversations. Stops when a full page of
 * results are all unchanged (already on disk with matching update_time).
 */
export async function listNewAndUpdatedConversations(
  client: ChatGptClient,
  token: string,
  outputDir: string,
): Promise<ClassifiedConversation[]> {
  const lookup = await buildLookupFromDisk(outputDir);
  const headers = buildHeaders(token);
  const result: ClassifiedConversation[] = [];
  let offset = 0;

  while (true) {
    const url = buildConversationListUrl(offset);
    const res = await client.fetch({ url, method: "GET", headers });
    const parsed = parseConversationList(JSON.parse(res.body));

    if (parsed.done) break;

    const { conversations, allUnchanged } = classifyPage(parsed.items, lookup);

    for (const conv of conversations) {
      if (conv.status !== "unchanged") {
        result.push(conv);
      }
    }

    if (allUnchanged) break;

    offset += parsed.items.length;
  }

  return result;
}
