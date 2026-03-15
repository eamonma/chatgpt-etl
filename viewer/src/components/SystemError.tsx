import type { MessageContent } from "../lib/thread";

export function SystemError({ content }: { content: MessageContent }) {
  const text = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  return (
    <div
      style={{
        background: "#2a0a0a",
        color: "#f7768e",
        padding: "12px",
        borderRadius: "6px",
        fontFamily: "monospace",
        fontSize: "0.875rem",
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}
