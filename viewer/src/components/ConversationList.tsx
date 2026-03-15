import { useCallback, useMemo, useState } from "react";
import { useConversations } from "../hooks/useConversations";
import { searchByTitle } from "../lib/search";
import { SearchBar } from "./SearchBar";

interface ConversationListProps {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export function ConversationList({ onSelect, selectedId }: ConversationListProps) {
  const { conversations, loading, error } = useConversations();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const filtered = useMemo(
    () => searchByTitle(conversations, query),
    [conversations, query],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SearchBar onSearch={handleSearch} />
      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`
              w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-800
              text-gray-900 dark:text-gray-100
              hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors
              ${selectedId === c.id ? "bg-gray-200 dark:bg-gray-800" : ""}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm font-medium">
                {c.title || "(untitled)"}
              </span>
              {c.status === "error" && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-red-500" title="Error" />
              )}
              {c.status === "pending" && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-yellow-500" title="Pending" />
              )}
            </div>
            {c.assetCount > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">
                {c.assetCount} file{c.assetCount !== 1 ? "s" : ""}
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
        {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
