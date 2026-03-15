import { useEffect, useState } from "react";
import { fetchManifest, fetchConversationsIndex } from "../api/client";
import type { ConversationIndexEntry } from "../types";

export interface ConversationListItem {
  id: string;
  title: string;
  status: "pending" | "complete" | "error";
  assetCount: number;
  create_time: number;
  update_time: number;
  error?: string;
}

export function useConversations(): {
  conversations: ConversationListItem[];
  loading: boolean;
  error: string | null;
} {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchManifest(), fetchConversationsIndex()])
      .then(([manifest, index]) => {
        if (cancelled) return;

        // Build a map from index for quick lookup
        const indexMap = new Map<string, ConversationIndexEntry>();
        for (const entry of index) {
          indexMap.set(entry.id, entry);
        }

        // Merge manifest + index
        const items: ConversationListItem[] = Object.values(manifest.conversations).map((mc) => {
          const idx = indexMap.get(mc.id);
          return {
            id: mc.id,
            title: mc.title,
            status: mc.status,
            assetCount: mc.assetCount,
            error: mc.error,
            create_time: idx?.create_time ?? 0,
            update_time: idx?.update_time ?? 0,
          };
        });

        // Sort by update_time descending (most recent first)
        items.sort((a, b) => b.update_time - a.update_time);
        setConversations(items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { conversations, loading, error };
}
