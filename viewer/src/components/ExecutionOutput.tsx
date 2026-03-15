import type { MessageContent } from "../lib/thread";

export function ExecutionOutput({ content }: { content: MessageContent }) {
  const text = (content as unknown as Record<string, unknown>).text as string | undefined;

  return (
    <pre
      style={{
        background: "#0d0d0d",
        color: "#b5b5b5",
        padding: "12px",
        borderRadius: "6px",
        overflow: "auto",
        margin: 0,
        fontFamily: "monospace",
        fontSize: "0.875rem",
      }}
    >
      {text ?? ""}
    </pre>
  );
}
