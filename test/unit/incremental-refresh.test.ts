import { describe, it, expect } from "vitest";
import type { ConversationSummary } from "../../src/types.js";
import {
  classifyPage,
  type StoredConversationLookup,
  type ClassifiedConversation,
} from "../../src/api/incremental-refresh.js";

function makeSummary(
  id: string,
  update_time: number,
  title?: string,
): ConversationSummary {
  return {
    id,
    title: title ?? `Conversation ${id}`,
    create_time: 1700000000,
    update_time,
  };
}

describe("classifyPage", () => {
  it("marks all conversations as 'new' when none exist on disk", () => {
    const page = [
      makeSummary("a", 100),
      makeSummary("b", 99),
      makeSummary("c", 98),
    ];
    const lookup: StoredConversationLookup = () => null;

    const result = classifyPage(page, lookup);

    expect(result.conversations).toEqual([
      { id: "a", title: "Conversation a", status: "new" },
      { id: "b", title: "Conversation b", status: "new" },
      { id: "c", title: "Conversation c", status: "new" },
    ]);
    expect(result.allUnchanged).toBe(false);
  });

  it("marks conversations as 'unchanged' when update_time matches", () => {
    const page = [
      makeSummary("a", 100),
      makeSummary("b", 99),
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return 100;
      if (id === "b") return 99;
      return null;
    };

    const result = classifyPage(page, lookup);

    expect(result.conversations).toEqual([
      { id: "a", title: "Conversation a", status: "unchanged" },
      { id: "b", title: "Conversation b", status: "unchanged" },
    ]);
    expect(result.allUnchanged).toBe(true);
  });

  it("marks conversations as 'updated' when update_time differs", () => {
    const page = [
      makeSummary("a", 200), // was 100 on disk
      makeSummary("b", 99),  // matches disk
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return 100;
      if (id === "b") return 99;
      return null;
    };

    const result = classifyPage(page, lookup);

    expect(result.conversations).toEqual([
      { id: "a", title: "Conversation a", status: "updated" },
      { id: "b", title: "Conversation b", status: "unchanged" },
    ]);
    expect(result.allUnchanged).toBe(false);
  });

  it("handles mixed page: new, updated, and unchanged", () => {
    const page = [
      makeSummary("new-1", 300),
      makeSummary("updated-1", 250),
      makeSummary("unchanged-1", 100),
      makeSummary("new-2", 90),
      makeSummary("unchanged-2", 80),
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "updated-1") return 200;    // different
      if (id === "unchanged-1") return 100;  // same
      if (id === "unchanged-2") return 80;   // same
      return null;                           // not on disk
    };

    const result = classifyPage(page, lookup);

    expect(result.conversations).toEqual([
      { id: "new-1", title: "Conversation new-1", status: "new" },
      { id: "updated-1", title: "Conversation updated-1", status: "updated" },
      { id: "unchanged-1", title: "Conversation unchanged-1", status: "unchanged" },
      { id: "new-2", title: "Conversation new-2", status: "new" },
      { id: "unchanged-2", title: "Conversation unchanged-2", status: "unchanged" },
    ]);
    expect(result.allUnchanged).toBe(false);
  });

  it("allUnchanged is true only when every item on the page is unchanged", () => {
    const page = [
      makeSummary("a", 100),
      makeSummary("b", 99),
      makeSummary("c", 98),
    ];
    // All match
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return 100;
      if (id === "b") return 99;
      if (id === "c") return 98;
      return null;
    };

    expect(classifyPage(page, lookup).allUnchanged).toBe(true);

    // One doesn't match — allUnchanged should be false
    const lookupWithOneNew: StoredConversationLookup = (id) => {
      if (id === "a") return 100;
      if (id === "b") return 99;
      // c not on disk
      return null;
    };

    expect(classifyPage(page, lookupWithOneNew).allUnchanged).toBe(false);
  });

  it("returns allUnchanged false for an empty page", () => {
    const result = classifyPage([], () => null);
    // Empty page means pagination is done (handled upstream), not "all unchanged"
    expect(result.allUnchanged).toBe(false);
    expect(result.conversations).toEqual([]);
  });

  it("treats fractional-second differences as unchanged", () => {
    // The list API and detail API can return slightly different fractional seconds
    // for the same conversation. We compare at integer-second granularity.
    const page = [
      makeSummary("a", 1700000100.999),  // API list says .999
      makeSummary("b", 1700000200.123),  // API list says .123
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return 1700000100.001;  // detail API saved .001
      if (id === "b") return 1700000200.789;  // detail API saved .789
      return null;
    };

    const result = classifyPage(page, lookup);

    expect(result.conversations[0].status).toBe("unchanged");
    expect(result.conversations[1].status).toBe("unchanged");
    expect(result.allUnchanged).toBe(true);
  });

  it("detects real updates even with fractional seconds", () => {
    // A real update changes the integer second, not just fractional part
    const page = [
      makeSummary("a", 1700000200.5),  // actually updated (was 1700000100)
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return 1700000100.5;
      return null;
    };

    const result = classifyPage(page, lookup);
    expect(result.conversations[0].status).toBe("updated");
  });

  it("handles update_time as string (API sometimes returns strings)", () => {
    const page: ConversationSummary[] = [
      {
        id: "a",
        title: "Conv A",
        create_time: "1700000000",
        update_time: "1700000100",
      },
    ];
    // Stored as number
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return 1700000100;
      return null;
    };

    const result = classifyPage(page, lookup);
    expect(result.conversations[0].status).toBe("unchanged");
    expect(result.allUnchanged).toBe(true);
  });

  it("treats ISO timestamp strings as unchanged when values match exactly", () => {
    const page: ConversationSummary[] = [
      {
        id: "a",
        title: "Conv A",
        create_time: "2025-02-01T00:00:00.000Z",
        update_time: "2025-02-01T12:34:56.789Z",
      },
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return "2025-02-01T12:34:56.789Z";
      return null;
    };

    const result = classifyPage(page, lookup);
    expect(result.conversations[0].status).toBe("unchanged");
    expect(result.allUnchanged).toBe(true);
  });

  it("marks ISO timestamp strings as updated when values differ", () => {
    const page: ConversationSummary[] = [
      {
        id: "a",
        title: "Conv A",
        create_time: "2025-02-01T00:00:00.000Z",
        update_time: "2025-02-01T12:34:56.790Z",
      },
    ];
    const lookup: StoredConversationLookup = (id) => {
      if (id === "a") return "2025-02-01T12:34:56.789Z";
      return null;
    };

    const result = classifyPage(page, lookup);
    expect(result.conversations[0].status).toBe("updated");
    expect(result.allUnchanged).toBe(false);
  });
});
