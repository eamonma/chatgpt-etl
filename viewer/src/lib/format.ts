export interface FormatMessage {
  role: string;
  recipient: string;
  contentType: string;
  parts: (string | Record<string, unknown>)[];
}

const SKIP_CONTENT_TYPES = new Set([
  "thoughts",
  "code",
  "execution_output",
  "user_editable_context",
  "model_editable_context",
  "reasoning_recap",
  "tether_browsing_display",
  "sonic_webpage",
  "computer_output",
  "system_error",
]);

const ALLOWED_ROLES = new Set(["user", "assistant"]);

const FILE_REF_PATTERN = /\{\{file:(file-[a-zA-Z0-9]+)\}\}/g;

export type ResolvedFiles = Map<string, { name: string; content: string }>;

export function formatThreadAsXml(
  messages: FormatMessage[],
  title: string,
  resolvedFiles?: ResolvedFiles,
): string {
  const contextLine = `<context>Continuing a conversation titled "${title}"</context>`;

  const formatted = messages
    .filter((m) => {
      if (!ALLOWED_ROLES.has(m.role)) return false;
      if (m.recipient !== undefined && m.recipient !== "all") return false;
      if (SKIP_CONTENT_TYPES.has(m.contentType)) return false;
      return true;
    })
    .map((m) => {
      const text = extractText(m, resolvedFiles);
      return `<${m.role}>${text}</${m.role}>`;
    });

  return [contextLine, ...formatted].join("\n\n");
}

/**
 * Collect all file IDs referenced in the thread messages.
 */
export function collectFileIds(messages: FormatMessage[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    for (const part of m.parts) {
      if (typeof part !== "string") continue;
      let match: RegExpExecArray | null;
      const re = new RegExp(FILE_REF_PATTERN.source, "g");
      while ((match = re.exec(part)) !== null) {
        ids.add(match[1]);
      }
    }
  }
  return [...ids];
}

/**
 * Resolve file IDs to their names and content via the server API.
 */
export async function resolveFiles(
  conversationId: string,
  fileIds: string[],
): Promise<ResolvedFiles> {
  const resolved: ResolvedFiles = new Map();
  await Promise.all(
    fileIds.map(async (fileId) => {
      try {
        const res = await fetch(`/api/assets/${conversationId}/resolve/${fileId}`);
        if (!res.ok) return;
        const name = res.headers.get("X-File-Name") ?? fileId;
        const content = await res.text();
        resolved.set(fileId, { name, content });
      } catch {
        // Skip unresolvable files
      }
    }),
  );
  return resolved;
}

// Strip all private-use Unicode markers: \ue200...\ue201 (or unclosed at end)
const MARKER_PATTERN = /\ue200[^\ue201]*(\ue201|$)/g;

function extractText(m: FormatMessage, resolvedFiles?: ResolvedFiles): string {
  const raw = m.parts.filter((p): p is string => typeof p === "string").join("\n");
  let text = raw.replace(MARKER_PATTERN, "");

  if (resolvedFiles && resolvedFiles.size > 0) {
    text = text.replace(FILE_REF_PATTERN, (_match, fileId: string) => {
      const file = resolvedFiles.get(fileId);
      if (!file) return "";
      return `\n<file name="${file.name}">\n${file.content}\n</file>\n`;
    });
  }

  return text;
}
