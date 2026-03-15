import type { MessageContent } from "../lib/thread";

export function CodeBlock({ content }: { content: MessageContent }) {
  const raw = content as unknown as Record<string, unknown>;
  const language = raw.language as string | undefined;
  const text = raw.text as string | undefined;

  return (
    <div style={{ position: "relative" }}>
      {language && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#aaa",
            padding: "4px 12px",
            background: "#1e1e1e",
            borderRadius: "6px 6px 0 0",
            fontFamily: "monospace",
          }}
        >
          {language}
        </div>
      )}
      <pre
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "12px",
          borderRadius: language ? "0 0 6px 6px" : "6px",
          overflow: "auto",
          margin: 0,
        }}
      >
        <code>{text ?? ""}</code>
      </pre>
    </div>
  );
}
