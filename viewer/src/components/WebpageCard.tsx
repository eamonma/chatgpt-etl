import type { MessageContent } from "../lib/thread";

interface SonicWebpageContent extends MessageContent {
  content_type: "sonic_webpage";
  url: string;
  domain: string;
  title: string;
  text: string;
  snippet: string;
  pub_date: string | null;
  crawl_date: string;
  ref_id: string;
}

export function WebpageCard({ content }: { content: MessageContent }) {
  const wc = content as unknown as SonicWebpageContent;
  const title = wc.title ?? "Untitled";
  const domain = wc.domain ?? "";
  const snippet = wc.snippet ?? "";
  const url = wc.url ?? "";
  const pubDate = wc.pub_date ?? null;

  return (
    <div
      style={{
        border: "1px solid #555",
        borderRadius: "6px",
        padding: "12px",
        background: "#1e2a1e",
        color: "#ccc",
        fontSize: "0.875rem",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: "4px",
          color: "#9ece6a",
          fontSize: "0.95rem",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
          fontSize: "0.8rem",
          color: "#888",
        }}
      >
        <span style={{ color: "#73daca" }}>{domain}</span>
        {pubDate && <span>&middot; {pubDate}</span>}
      </div>
      {snippet && (
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#bbb" }}>
          {snippet}
        </div>
      )}
      {url && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "0.75rem",
            color: "#666",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </div>
      )}
    </div>
  );
}
