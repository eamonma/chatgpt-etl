import type { MessageContent } from "../lib/thread";

export function ReasoningRecap({ content }: { content: MessageContent }) {
  const text = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  return (
    <div
      style={{
        borderLeft: "3px solid #bb9af7",
        paddingLeft: "12px",
        color: "#bbb",
        fontStyle: "italic",
        whiteSpace: "pre-wrap",
        fontSize: "0.875rem",
      }}
    >
      {text}
    </div>
  );
}
