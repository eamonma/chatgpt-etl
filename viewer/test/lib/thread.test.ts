import { describe, it, expect } from "vitest";
import {
  extractThread,
  switchBranch,
  filterVisibleMessages,
  type MappingNode,
  type ThreadNode,
} from "../../src/lib/thread";

function makeNode(
  id: string,
  parent: string | null,
  children: string[],
  message: MappingNode["message"] = null
): MappingNode {
  return { id, message, parent, children };
}

function makeMessage(
  id: string,
  role: string,
  contentType = "text",
  extra: {
    metadata?: Record<string, unknown>;
    channel?: string;
  } = {}
): MappingNode["message"] {
  return {
    id,
    author: { role },
    create_time: null,
    update_time: null,
    content: { content_type: contentType },
    metadata: extra.metadata ?? {},
    ...(extra.channel !== undefined ? { channel: extra.channel } : {}),
  } as MappingNode["message"];
}

describe("extractThread", () => {
  it("extracts a linear thread from a simple 3-node conversation", () => {
    const mapping: Record<string, MappingNode> = {
      root: makeNode("root", null, ["user1"]),
      user1: makeNode("user1", "root", ["asst1"], makeMessage("user1", "user")),
      asst1: makeNode("asst1", "user1", [], makeMessage("asst1", "assistant")),
    };

    const thread = extractThread(mapping, "asst1");

    expect(thread).toHaveLength(3);
    expect(thread[0].node.id).toBe("root");
    expect(thread[1].node.id).toBe("user1");
    expect(thread[2].node.id).toBe("asst1");

    // No branches anywhere
    expect(thread[0].totalChildren).toBe(1);
    expect(thread[0].activeChildIndex).toBe(0);
    expect(thread[2].totalChildren).toBe(0);
  });

  it("extracts correct branch metadata from conversation with 2 branches", () => {
    // root -> user1 -> [asst1a, asst1b]
    // currentNode = asst1b (second branch)
    const mapping: Record<string, MappingNode> = {
      root: makeNode("root", null, ["user1"]),
      user1: makeNode("user1", "root", ["asst1a", "asst1b"], makeMessage("user1", "user")),
      asst1a: makeNode("asst1a", "user1", [], makeMessage("asst1a", "assistant")),
      asst1b: makeNode("asst1b", "user1", [], makeMessage("asst1b", "assistant")),
    };

    const thread = extractThread(mapping, "asst1b");

    expect(thread).toHaveLength(3);
    expect(thread[0].node.id).toBe("root");
    expect(thread[1].node.id).toBe("user1");
    expect(thread[2].node.id).toBe("asst1b");

    // user1 has 2 children, active is index 1 (asst1b)
    expect(thread[1].totalChildren).toBe(2);
    expect(thread[1].activeChildIndex).toBe(1);
  });
});

describe("switchBranch", () => {
  it("returns thread following alternative branch to its leaf", () => {
    // root -> user1 -> [asst1a -> user2a -> asst2a, asst1b]
    const mapping: Record<string, MappingNode> = {
      root: makeNode("root", null, ["user1"]),
      user1: makeNode("user1", "root", ["asst1a", "asst1b"], makeMessage("user1", "user")),
      asst1a: makeNode("asst1a", "user1", ["user2a"], makeMessage("asst1a", "assistant")),
      user2a: makeNode("user2a", "asst1a", ["asst2a"], makeMessage("user2a", "user")),
      asst2a: makeNode("asst2a", "user2a", [], makeMessage("asst2a", "assistant")),
      asst1b: makeNode("asst1b", "user1", [], makeMessage("asst1b", "assistant")),
    };

    // Start on branch a (deep)
    const thread = extractThread(mapping, "asst2a");
    expect(thread[1].activeChildIndex).toBe(0); // user1 -> asst1a

    // Switch user1's active child to index 1 (asst1b)
    const newThread = switchBranch(mapping, thread, "user1", 1);

    // New thread should follow asst1b to its leaf
    expect(newThread).toHaveLength(3); // root, user1, asst1b
    expect(newThread[2].node.id).toBe("asst1b");
    expect(newThread[1].activeChildIndex).toBe(1);
    expect(newThread[1].totalChildren).toBe(2);
  });
});

describe("filterVisibleMessages", () => {
  it("removes system, hidden, and special content type messages", () => {
    const mapping: Record<string, MappingNode> = {
      root: makeNode("root", null, ["sys"]),
      sys: makeNode("sys", "root", ["user1"], makeMessage("sys", "system")),
      user1: makeNode("user1", "sys", ["hidden"], makeMessage("user1", "user")),
      hidden: makeNode(
        "hidden",
        "user1",
        ["commentary"],
        makeMessage("hidden", "assistant", "text", {
          metadata: { is_visually_hidden_from_conversation: true },
        })
      ),
      commentary: makeNode(
        "commentary",
        "hidden",
        ["ctx1"],
        makeMessage("commentary", "assistant", "text", { channel: "commentary" })
      ),
      ctx1: makeNode(
        "ctx1",
        "commentary",
        ["ctx2"],
        makeMessage("ctx1", "tool", "user_editable_context")
      ),
      ctx2: makeNode(
        "ctx2",
        "ctx1",
        ["asst1"],
        makeMessage("ctx2", "tool", "model_editable_context")
      ),
      asst1: makeNode("asst1", "ctx2", [], makeMessage("asst1", "assistant")),
    };

    const thread = extractThread(mapping, "asst1");
    const visible = filterVisibleMessages(thread);

    // Only user1 and asst1 should be visible
    expect(visible).toHaveLength(2);
    expect(visible[0].node.id).toBe("user1");
    expect(visible[1].node.id).toBe("asst1");
  });
});
