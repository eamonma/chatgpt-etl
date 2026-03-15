import { describe, it, expect } from "vitest";
import { searchByTitle, searchConversationContent } from "../../src/lib/search";
import type { ManifestConversation, ConversationFile } from "../../src/types";

function makeManifestConvo(
  id: string,
  title: string,
  status: ManifestConversation["status"] = "complete",
  assetCount = 0
): ManifestConversation {
  return { id, title, status, assetCount };
}

function makeConversationFile(
  id: string,
  title: string,
  mapping: Record<string, unknown>
): ConversationFile {
  return {
    id,
    title,
    create_time: Date.now() / 1000,
    update_time: Date.now() / 1000,
    mapping,
  };
}

function makeNode(
  id: string,
  parent: string | null,
  children: string[],
  message: unknown = null
): unknown {
  return { id, message, parent, children };
}

function makeMessage(
  role: string,
  contentType: string,
  parts: (string | Record<string, unknown>)[]
): unknown {
  return {
    id: crypto.randomUUID(),
    author: { role },
    create_time: null,
    update_time: null,
    content: { content_type: contentType, parts },
    metadata: {},
  };
}

describe("searchByTitle", () => {
  it("finds conversations by case-insensitive title match", () => {
    const conversations = [
      makeManifestConvo("1", "React Hooks Tutorial"),
      makeManifestConvo("2", "Python Basics"),
      makeManifestConvo("3", "Advanced REACT Patterns"),
    ];

    const results = searchByTitle(conversations, "react");

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("returns all conversations for empty query", () => {
    const conversations = [
      makeManifestConvo("1", "Chat A"),
      makeManifestConvo("2", "Chat B"),
    ];

    const results = searchByTitle(conversations, "");

    expect(results).toHaveLength(2);
  });

  it("returns empty array when no titles match", () => {
    const conversations = [
      makeManifestConvo("1", "React Hooks"),
      makeManifestConvo("2", "Python Basics"),
    ];

    const results = searchByTitle(conversations, "golang");

    expect(results).toHaveLength(0);
  });
});

describe("searchConversationContent", () => {
  it("finds text in message parts", () => {
    const convo = makeConversationFile("c1", "Test Chat", {
      root: makeNode("root", null, ["msg1"]),
      msg1: makeNode(
        "msg1",
        "root",
        [],
        makeMessage("user", "text", ["Hello, I need help with TypeScript generics"])
      ),
    });

    const result = searchConversationContent(convo, "typescript");

    expect(result).not.toBeNull();
    expect(result!.conversationId).toBe("c1");
    expect(result!.title).toBe("Test Chat");
    expect(result!.matches).toHaveLength(1);
    expect(result!.matches[0].role).toBe("user");
  });

  it("returns snippets with context around match", () => {
    const longText =
      "This is a long message with some padding before the keyword. " +
      "The important TypeScript feature is generics. " +
      "And here is some more text after the keyword for context.";

    const convo = makeConversationFile("c2", "Long Chat", {
      root: makeNode("root", null, ["msg1"]),
      msg1: makeNode(
        "msg1",
        "root",
        [],
        makeMessage("assistant", "text", [longText])
      ),
    });

    const result = searchConversationContent(convo, "TypeScript");

    expect(result).not.toBeNull();
    expect(result!.matches).toHaveLength(1);
    const snippet = result!.matches[0].snippet;
    // Snippet should contain the match
    expect(snippet.toLowerCase()).toContain("typescript");
    // Snippet should be a substring of the original, not the whole thing
    expect(snippet.length).toBeLessThanOrEqual(longText.length);
    expect(snippet.length).toBeGreaterThan(0);
  });

  it("returns null when no match is found", () => {
    const convo = makeConversationFile("c3", "No Match", {
      root: makeNode("root", null, ["msg1"]),
      msg1: makeNode(
        "msg1",
        "root",
        [],
        makeMessage("user", "text", ["Hello, how are you?"])
      ),
    });

    const result = searchConversationContent(convo, "typescript");

    expect(result).toBeNull();
  });

  it("handles multimodal_text content type with mixed parts", () => {
    const convo = makeConversationFile("c4", "Multimodal Chat", {
      root: makeNode("root", null, ["msg1"]),
      msg1: makeNode(
        "msg1",
        "root",
        [],
        makeMessage("user", "multimodal_text", [
          "Check this image:",
          { asset_pointer: "file://image.png", content_type: "image/png" },
          "It shows a TypeScript error",
        ])
      ),
    });

    const result = searchConversationContent(convo, "typescript");

    expect(result).not.toBeNull();
    expect(result!.matches).toHaveLength(1);
    expect(result!.matches[0].snippet.toLowerCase()).toContain("typescript");
  });

  it("finds matches across multiple messages", () => {
    const convo = makeConversationFile("c5", "Multi Message", {
      root: makeNode("root", null, ["msg1"]),
      msg1: makeNode(
        "msg1",
        "root",
        ["msg2"],
        makeMessage("user", "text", ["How do I use TypeScript?"])
      ),
      msg2: makeNode(
        "msg2",
        "msg1",
        [],
        makeMessage("assistant", "text", [
          "TypeScript is a typed superset of JavaScript.",
        ])
      ),
    });

    const result = searchConversationContent(convo, "typescript");

    expect(result).not.toBeNull();
    expect(result!.matches).toHaveLength(2);
    expect(result!.matches[0].role).toBe("user");
    expect(result!.matches[1].role).toBe("assistant");
  });

  it("skips nodes without messages", () => {
    const convo = makeConversationFile("c6", "With Root", {
      root: makeNode("root", null, ["msg1"]),
      msg1: makeNode(
        "msg1",
        "root",
        [],
        makeMessage("user", "text", ["TypeScript is great"])
      ),
    });

    const result = searchConversationContent(convo, "typescript");

    expect(result).not.toBeNull();
    expect(result!.matches).toHaveLength(1);
  });
});
