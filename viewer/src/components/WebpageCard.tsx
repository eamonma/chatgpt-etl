import type { MessageContent } from "../lib/thread";

export function WebpageCard({ content }: { content: MessageContent }) {
  const text = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  return (
    <div
      style={{
        border: "1px solid #555",
        borderRadius: "6px",
        padding: "12px",
        background: "#1e2a1e",
        color: "#ccc",
        whiteSpace: "pre-wrap",
        fontSize: "0.875rem",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "4px", color: "#9ece6a" }}>
        Webpage
      </div>
      {text}
    </div>
  );
}
