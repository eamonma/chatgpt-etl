import { useEffect, useState } from "react";
import { fetchConversation } from "../api/client";
import type { ConversationFile } from "../types";
import type { MappingNode, ThreadNode } from "../lib/thread";
import { extractThread, filterVisibleMessages } from "../lib/thread";

export function useConversation(id: string): {
  conversation: ConversationFile | null;
  thread: ThreadNode[];
  visibleThread: ThreadNode[];
  loading: boolean;
  error: string | null;
} {
  const [conversation, setConversation] = useState<ConversationFile | null>(
    null,
  );
  const [thread, setThread] = useState<ThreadNode[]>([]);
  const [visibleThread, setVisibleThread] = useState<ThreadNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchConversation(id)
      .then((conv) => {
        if (cancelled) return;
        setConversation(conv);

        const mapping = conv.mapping as Record<string, MappingNode>;

        // Find the leaf node: a node with no children (or whose children are empty)
        // We pick the deepest node by walking from any node that has no children.
        let leafId: string | null = null;
        for (const [nodeId, node] of Object.entries(mapping)) {
          if (node.children.length === 0) {
            leafId = nodeId;
            break;
          }
        }

        if (leafId == null) {
          setThread([]);
          setVisibleThread([]);
          return;
        }

        const extracted = extractThread(mapping, leafId);
        setThread(extracted);
        setVisibleThread(filterVisibleMessages(extracted));
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
  }, [id]);

  return { conversation, thread, visibleThread, loading, error };
}
