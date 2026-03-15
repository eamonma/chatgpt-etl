import { describe, it, expect } from "vitest";
import { formatThreadAsXml, FormatMessage } from "../../src/lib/format";

describe("formatThreadAsXml", () => {
  it("formats a simple 2-message user/assistant thread as XML", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: "all",
        contentType: "text",
        parts: ["Hello, how are you?"],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "text",
        parts: ["I'm doing well, thanks for asking!"],
      },
    ];

    const result = formatThreadAsXml(messages, "Test Chat");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Test Chat"</context>\n\n<user>Hello, how are you?</user>\n\n<assistant>I'm doing well, thanks for asking!</assistant>`
    );
  });

  it("skips tool messages (role !== user/assistant)", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: "all",
        contentType: "text",
        parts: ["Search for cats"],
      },
      {
        role: "tool",
        recipient: "all",
        contentType: "text",
        parts: ["tool result here"],
      },
      {
        role: "system",
        recipient: "all",
        contentType: "text",
        parts: ["system prompt"],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "text",
        parts: ["Here are some cats!"],
      },
    ];

    const result = formatThreadAsXml(messages, "Cat Search");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Cat Search"</context>\n\n<user>Search for cats</user>\n\n<assistant>Here are some cats!</assistant>`
    );
  });

  it("skips messages with recipient !== 'all'", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: "all",
        contentType: "text",
        parts: ["Draw me a picture"],
      },
      {
        role: "assistant",
        recipient: "dalle.text2im",
        contentType: "text",
        parts: ["generating image..."],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "text",
        parts: ["Here is your picture!"],
      },
    ];

    const result = formatThreadAsXml(messages, "Art");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Art"</context>\n\n<user>Draw me a picture</user>\n\n<assistant>Here is your picture!</assistant>`
    );
  });

  it("includes messages where recipient is undefined", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: undefined as unknown as string,
        contentType: "text",
        parts: ["Hello"],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "text",
        parts: ["Hi there"],
      },
    ];

    const result = formatThreadAsXml(messages, "Greetings");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Greetings"</context>\n\n<user>Hello</user>\n\n<assistant>Hi there</assistant>`
    );
  });

  it("handles multimodal_text by extracting only string parts", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: "all",
        contentType: "multimodal_text",
        parts: [
          "Here is an image",
          { asset_pointer: "file-abc123", content_type: "image/png" },
          "What do you see?",
        ],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "text",
        parts: ["I see a cat."],
      },
    ];

    const result = formatThreadAsXml(messages, "Image Chat");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Image Chat"</context>\n\n<user>Here is an image\nWhat do you see?</user>\n\n<assistant>I see a cat.</assistant>`
    );
  });

  it("skips messages with disallowed content types", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: "all",
        contentType: "text",
        parts: ["Run this code"],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "code",
        parts: ["print('hello')"],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "execution_output",
        parts: ["hello"],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "thoughts",
        parts: ["thinking..."],
      },
      {
        role: "assistant",
        recipient: "all",
        contentType: "text",
        parts: ["Done! The output was hello."],
      },
    ];

    const result = formatThreadAsXml(messages, "Code");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Code"</context>\n\n<user>Run this code</user>\n\n<assistant>Done! The output was hello.</assistant>`
    );
  });

  it("joins multiple text parts with newlines", () => {
    const messages: FormatMessage[] = [
      {
        role: "user",
        recipient: "all",
        contentType: "text",
        parts: ["First paragraph", "Second paragraph"],
      },
    ];

    const result = formatThreadAsXml(messages, "Multi");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Multi"</context>\n\n<user>First paragraph\nSecond paragraph</user>`
    );
  });

  it("returns only context line when all messages are filtered out", () => {
    const messages: FormatMessage[] = [
      {
        role: "system",
        recipient: "all",
        contentType: "text",
        parts: ["You are helpful"],
      },
    ];

    const result = formatThreadAsXml(messages, "Empty");

    expect(result).toBe(
      `<context>Continuing a conversation titled "Empty"</context>`
    );
  });
});
