import type { MessageContent } from "../lib/thread";

interface SystemErrorContent extends MessageContent {
  content_type: "system_error";
  name: string;
  text: string;
}

export function SystemError({ content }: { content: MessageContent }) {
  const se = content as unknown as SystemErrorContent;
  const name = se.name ?? "Error";
  const text =
    se.text ??
    (se.parts ?? []).filter((p): p is string => typeof p === "string").join("\n");

  return (
    <div
      style={{
        background: "#2a0a0a",
        border: "1px solid #f7768e",
        borderRadius: "6px",
        padding: "12px",
        fontSize: "0.875rem",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "#f7768e",
          marginBottom: "6px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span>&#x26A0;</span> {name}
      </div>
      <div
        style={{
          whiteSpace: "pre-wrap",
          color: "#e08080",
          fontFamily: "monospace",
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
}
