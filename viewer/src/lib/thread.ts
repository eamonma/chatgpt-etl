// Types defined inline (not imported from parent project)

export interface MessageContent {
  content_type: string;
  parts?: (string | Record<string, unknown>)[];
}

export interface Message {
  id: string;
  author: { role: string; name?: string; metadata?: Record<string, unknown> };
  create_time: number | null;
  update_time: number | null;
  content: MessageContent;
  metadata: Record<string, unknown>;
  recipient?: string;
  channel?: string;
}

export interface MappingNode {
  id: string;
  message: Message | null;
  parent: string | null;
  children: string[];
}

export interface ThreadNode {
  node: MappingNode;
  activeChildIndex: number;
  totalChildren: number;
}

/** A group of messages forming one visual "turn" in the conversation. */
export interface MessageGroup {
  role: "user" | "assistant";
  messages: ThreadNode[];
}

/**
 * Walk from currentNode up to root via parent pointers,
 * then return the path in root-to-leaf order with branch metadata.
 */
export function extractThread(
  mapping: Record<string, MappingNode>,
  currentNode: string
): ThreadNode[] {
  // Walk up from currentNode to root, collecting the path
  const path: string[] = [];
  let nodeId: string | null = currentNode;
  while (nodeId != null) {
    path.push(nodeId);
    nodeId = mapping[nodeId].parent;
  }
  path.reverse();

  // Build ThreadNode array with branch metadata
  return path.map((id, i) => {
    const node = mapping[id];
    const nextId = i < path.length - 1 ? path[i + 1] : null;
    const activeChildIndex = nextId != null ? node.children.indexOf(nextId) : 0;
    return {
      node,
      activeChildIndex: Math.max(activeChildIndex, 0),
      totalChildren: node.children.length,
    };
  });
}

/**
 * Given a thread and a branching node ID, switch to a different child index.
 * Follows the new branch down to its leaf (always picking the first child).
 */
export function switchBranch(
  mapping: Record<string, MappingNode>,
  thread: ThreadNode[],
  nodeId: string,
  newChildIndex: number
): ThreadNode[] {
  // Find the branching node in the thread
  const branchIdx = thread.findIndex((t) => t.node.id === nodeId);
  if (branchIdx === -1) {
    throw new Error(`Node ${nodeId} not found in thread`);
  }

  const branchNode = thread[branchIdx].node;
  if (newChildIndex < 0 || newChildIndex >= branchNode.children.length) {
    throw new Error(`Child index ${newChildIndex} out of range`);
  }

  // Keep everything up to and including the branch node
  const prefix = thread.slice(0, branchIdx + 1).map((t, i) => {
    if (i === branchIdx) {
      return { ...t, activeChildIndex: newChildIndex };
    }
    return t;
  });

  // Walk down from the new child, always picking first child
  let currentId = branchNode.children[newChildIndex];
  const suffix: ThreadNode[] = [];
  while (currentId != null) {
    const node = mapping[currentId];
    suffix.push({
      node,
      activeChildIndex: 0,
      totalChildren: node.children.length,
    });
    currentId = node.children.length > 0 ? node.children[0] : (null as unknown as string);
  }

  return [...prefix, ...suffix];
}

/**
 * Filter thread nodes to only those that should be displayed.
 */
export function filterVisibleMessages(thread: ThreadNode[]): ThreadNode[] {
  return thread.filter((t) => {
    const msg = t.node.message;
    if (msg == null) return false;
    if (msg.author.role === "system") return false;
    if (msg.metadata?.is_visually_hidden_from_conversation) return false;
    // Commentary from non-assistant roles is internal; assistant commentary
    // is "thinking aloud" preamble text shown in ChatGPT's UI.
    if (msg.channel === "commentary" && msg.author.role !== "assistant") return false;
    if (msg.content.content_type === "user_editable_context") return false;
    if (msg.content.content_type === "model_editable_context") return false;
    return true;
  });
}

/**
 * Group visible messages into conversation turns.
 * User messages are their own group. Everything else (assistant, tool,
 * thoughts, code, etc.) between user messages gets grouped together.
 */
export function groupMessages(thread: ThreadNode[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const tn of thread) {
    const msg = tn.node.message;
    if (!msg) continue;

    if (msg.author.role === "user") {
      // Flush any pending assistant group
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      groups.push({ role: "user", messages: [tn] });
    } else {
      // assistant, tool, or any non-user message — group together
      if (!currentGroup) {
        currentGroup = { role: "assistant", messages: [] };
      }
      currentGroup.messages.push(tn);
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
