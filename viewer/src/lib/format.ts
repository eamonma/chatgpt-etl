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

export function formatThreadAsXml(
  messages: FormatMessage[],
  title: string,
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
      const text = extractText(m);
      return `<${m.role}>${text}</${m.role}>`;
    });

  return [contextLine, ...formatted].join("\n\n");
}

// Strip all private-use Unicode markers: \ue200...\ue201 (or unclosed at end)
const MARKER_PATTERN = /\ue200[^\ue201]*(\ue201|$)/g;

function extractText(m: FormatMessage): string {
  const raw = m.parts.filter((p): p is string => typeof p === "string").join("\n");
  return raw.replace(MARKER_PATTERN, "");
}
