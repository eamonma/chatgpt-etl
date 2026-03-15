import type { MessageContent } from "../lib/thread";

interface ReasoningRecapContent extends MessageContent {
  content_type: "reasoning_recap";
  content: string;
}

export function ReasoningRecap({ content }: { content: MessageContent }) {
  const rc = content as unknown as ReasoningRecapContent;
  const text =
    rc.content ??
    (rc.parts ?? []).filter((p): p is string => typeof p === "string").join("\n");

  return (
    <div
      style={{
        borderLeft: "3px solid #bb9af7",
        paddingLeft: "12px",
        padding: "10px 12px",
        background: "#1a1a2a",
        borderRadius: "0 6px 6px 0",
        color: "#bbb",
        fontStyle: "italic",
        whiteSpace: "pre-wrap",
        fontSize: "0.875rem",
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "#bb9af7",
          marginBottom: "6px",
          fontStyle: "normal",
          fontSize: "0.8rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Reasoning Summary
      </div>
      {text}
    </div>
  );
}
