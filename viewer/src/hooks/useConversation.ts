import { useCallback, useEffect, useState } from "react";
import { fetchConversation } from "../api/client";
import type { ConversationFile } from "../types";
import type { MappingNode, ThreadNode, MessageGroup } from "../lib/thread";
import { extractThread, filterVisibleMessages, groupMessages, switchBranch } from "../lib/thread";

export function useConversation(id: string): {
  conversation: ConversationFile | null;
  thread: ThreadNode[];
  visibleThread: ThreadNode[];
  messageGroups: MessageGroup[];
  loading: boolean;
  error: string | null;
  handleSwitchBranch: (nodeId: string, newChildIndex: number) => void;
} {
  const [conversation, setConversation] = useState<ConversationFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, MappingNode>>({});
  const [thread, setThread] = useState<ThreadNode[]>([]);
  const [visibleThread, setVisibleThread] = useState<ThreadNode[]>([]);
  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);
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

        const m = conv.mapping as Record<string, MappingNode>;
        setMapping(m);

        // Use current_node if available, otherwise find a leaf
        let leafId: string | null = (conv as Record<string, unknown>).current_node as string | null;
        if (!leafId || !m[leafId]) {
          for (const [nodeId, node] of Object.entries(m)) {
            if (node.children.length === 0) {
              leafId = nodeId;
              break;
            }
          }
        }

        if (leafId == null) {
          setThread([]);
          setVisibleThread([]);
          setMessageGroups([]);
          return;
        }

        const extracted = extractThread(m, leafId);
        const visible = filterVisibleMessages(extracted);
        setThread(extracted);
        setVisibleThread(visible);
        setMessageGroups(groupMessages(visible));
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

  const handleSwitchBranch = useCallback(
    (nodeId: string, newChildIndex: number) => {
      try {
        const newThread = switchBranch(mapping, thread, nodeId, newChildIndex);
        const visible = filterVisibleMessages(newThread);
        setThread(newThread);
        setVisibleThread(visible);
        setMessageGroups(groupMessages(visible));
      } catch (e) {
        console.error("Failed to switch branch:", e);
      }
    },
    [mapping, thread],
  );

  return { conversation, thread, visibleThread, messageGroups, loading, error, handleSwitchBranch };
}
