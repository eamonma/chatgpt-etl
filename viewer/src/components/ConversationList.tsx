import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useConversations, type ConversationListItem } from "../hooks/useConversations";
import { SearchBar } from "./SearchBar";

interface ConversationListProps {
  selectedId: string | null;
}

function searchFilter(conversations: ConversationListItem[], query: string): ConversationListItem[] {
  if (!query.trim()) return conversations;
  const q = query.toLowerCase();
  return conversations.filter((c) => c.title.toLowerCase().includes(q));
}

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function ConversationList({ selectedId }: ConversationListProps) {
  const { conversations, loading, error } = useConversations();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const filtered = useMemo(
    () => searchFilter(conversations, query),
    [conversations, query],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="animate-pulse">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SearchBar onSearch={handleSearch} />
      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => (
          <Link
            key={c.id}
            to={`/c/${c.id}`}
            className={`
              block w-full text-left px-4 py-3 border-b border-border
              hover:bg-secondary transition-colors no-underline
              ${selectedId === c.id ? "bg-secondary" : ""}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm font-medium">
                {c.title || "(untitled)"}
              </span>
              {c.status === "error" && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-destructive" title="Error" />
              )}
              {c.status === "pending" && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-yellow-500" title="Pending" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatDate(c.update_time)}
              </span>
              {c.assetCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {c.assetCount} file{c.assetCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
