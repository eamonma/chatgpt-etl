import type { MessageContent } from "../lib/thread";

interface BrowsingContent extends MessageContent {
  content_type: "tether_browsing_display";
  result: string;
  summary: string | null;
  assets: unknown[];
  tether_id: string | null;
}

export function BrowsingDisplay({ content }: { content: MessageContent }) {
  const bc = content as unknown as BrowsingContent;
  const result = bc.result ?? "";
  const summary = bc.summary ?? null;

  return (
    <div
      style={{
        border: "1px solid #555",
        borderRadius: "6px",
        padding: "12px",
        background: "#1a1a2e",
        color: "#ccc",
        fontSize: "0.875rem",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: "8px",
          color: "#7aa2f7",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={{ fontSize: "1rem" }}>&#x1F310;</span> Browsing Result
      </div>
      {summary && (
        <div
          style={{
            marginBottom: "8px",
            padding: "8px",
            background: "#1e1e3a",
            borderRadius: "4px",
            color: "#a9b1d6",
            fontStyle: "italic",
          }}
        >
          {summary}
        </div>
      )}
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{result}</div>
    </div>
  );
}
