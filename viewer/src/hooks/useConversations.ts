import { useEffect, useState } from "react";
import { fetchManifest } from "../api/client";
import type { ManifestConversation } from "../types";

export function useConversations(): {
  conversations: ManifestConversation[];
  loading: boolean;
  error: string | null;
} {
  const [conversations, setConversations] = useState<ManifestConversation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchManifest()
      .then((manifest) => {
        if (cancelled) return;
        const sorted = Object.values(manifest.conversations).sort((a, b) =>
          a.title.localeCompare(b.title),
        );
        setConversations(sorted);
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
