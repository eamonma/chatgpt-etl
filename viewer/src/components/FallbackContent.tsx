import type { MessageContent } from "../lib/thread";

export function FallbackContent({ content }: { content: MessageContent }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "#888",
          marginBottom: "4px",
          fontFamily: "monospace",
        }}
      >
        {content.content_type}
      </div>
      <pre
        style={{
          background: "#1a1a1a",
          color: "#aaa",
          padding: "8px",
          borderRadius: "6px",
          overflow: "auto",
          fontSize: "0.75rem",
          margin: 0,
        }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}
