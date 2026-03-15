import type { MessageContent } from "../lib/thread";

export function ComputerOutput({ content }: { content: MessageContent }) {
  const text = (content as unknown as Record<string, unknown>).text as string | undefined;

  return (
    <pre
      style={{
        background: "#0a0a0a",
        color: "#a0a0a0",
        padding: "12px",
        borderRadius: "6px",
        overflow: "auto",
        margin: 0,
        fontFamily: "monospace",
        fontSize: "0.875rem",
        borderLeft: "3px solid #666",
      }}
    >
      {text ?? ""}
    </pre>
  );
}
