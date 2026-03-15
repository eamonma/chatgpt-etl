import type { MessageContent } from "../lib/thread";

export function TextContent({ content }: { content: MessageContent }) {
  const text = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  return <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>;
}
