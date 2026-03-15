import { useState } from "react";
import type { MessageContent } from "../lib/thread";

interface Thought {
  summary: string;
  content: string;
  finished: boolean;
}

export function ThinkingBlock({ content }: { content: MessageContent }) {
  const [expanded, setExpanded] = useState(false);

  const raw = (content as unknown as Record<string, unknown>).thoughts as string | undefined;
  let thoughts: Thought[] = [];
  if (raw) {
    try {
      thoughts = JSON.parse(raw) as Thought[];
    } catch {
      // If parsing fails, show raw text as a single thought
      thoughts = [{ summary: "Thought", content: raw, finished: true }];
    }
  }

  return (
    <div
      style={{
        border: "1px solid #444",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          background: "#2a2a2a",
          color: "#ccc",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontWeight: 600,
          fontSize: "0.875rem",
        }}
      >
        {expanded ? "\u25BC" : "\u25B6"} Thinking\u2026
      </button>
      {expanded && (
        <div style={{ padding: "8px 12px", background: "#1a1a1a" }}>
          {thoughts.map((t, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              {t.summary && (
                <div style={{ fontWeight: 600, color: "#aaa", marginBottom: "4px" }}>
                  {t.summary}
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap", color: "#ccc", fontSize: "0.875rem" }}>
                {t.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
