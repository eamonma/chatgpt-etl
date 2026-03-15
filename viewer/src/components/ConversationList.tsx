import { useCallback, useMemo, useState } from "react";
import { useConversations } from "../hooks/useConversations";
import { searchByTitle } from "../lib/search";
import { SearchBar } from "./SearchBar";
import type { ManifestConversation } from "../types";

const statusColors: Record<ManifestConversation["status"], string> = {
  complete: "#22c55e",
  error: "#ef4444",
  pending: "#f59e0b",
};

interface ConversationListProps {
  onSelect: (id: string) => void;
}

export function ConversationList({ onSelect }: ConversationListProps) {
  const { conversations, loading, error } = useConversations();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const filtered = useMemo(
    () => searchByTitle(conversations, query),
    [conversations, query]
  );

  if (loading) {
    return <p style={{ padding: 24, color: "#888" }}>Loading conversations...</p>;
  }

  if (error) {
    return (
      <p style={{ padding: 24, color: "#ef4444" }}>
        Error loading conversations: {error}
      </p>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "8px 0",
      }}
    >
      <SearchBar onSearch={handleSearch} />
      {filtered.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "10px 16px",
            border: "none",
            borderBottom: "1px solid #e5e7eb",
            background: "none",
            cursor: "pointer",
            textAlign: "left",
            fontSize: 14,
          }}
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.title || "(untitled)"}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              color: "#fff",
              background: statusColors[c.status],
              flexShrink: 0,
            }}
          >
            {c.status}
          </span>

          {c.assetCount > 0 && (
            <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>
              {c.assetCount} asset{c.assetCount !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
