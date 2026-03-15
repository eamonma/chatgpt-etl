import type { MessageGroup as MessageGroupType } from "../lib/thread";
import { ContentRenderer } from "./ContentRenderer";
import { ThinkingBlock } from "./ThinkingBlock";

function formatTimestamp(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Content types that represent "internal" tool/thinking work, shown collapsed. */
const TOOL_CONTENT_TYPES = new Set([
  "code",
  "execution_output",
  "tether_browsing_display",
  "sonic_webpage",
  "computer_output",
]);

export function MessageGroup({
  group,
  conversationId,
}: {
  group: MessageGroupType;
  conversationId: string;
}) {
  if (group.role === "user") {
    const msg = group.messages[0]?.node.message;
    if (!msg) return null;

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
            <div className="text-sm">
              <ContentRenderer
                content={msg.content}
                conversationId={conversationId}
                contentReferences={msg.metadata?.content_references as unknown[] | undefined}
              />
            </div>
          </div>
          {msg.create_time && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
              {formatTimestamp(msg.create_time)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant group: may contain assistant text, tool calls, thoughts, etc.
  // Find the "main" assistant message (the visible text response)
  const mainMessages = group.messages.filter((tn) => {
    const msg = tn.node.message;
    if (!msg) return false;
    return msg.author.role === "assistant" &&
      msg.content.content_type === "text" &&
      msg.recipient === "all";
  });

  const thinkingMessages = group.messages.filter((tn) => {
    const msg = tn.node.message;
    return msg?.content.content_type === "thoughts";
  });

  const reasoningMessages = group.messages.filter((tn) => {
    const msg = tn.node.message;
    return msg?.content.content_type === "reasoning_recap";
  });

  const toolMessages = group.messages.filter((tn) => {
    const msg = tn.node.message;
    if (!msg) return false;
    return msg.author.role === "tool" || TOOL_CONTENT_TYPES.has(msg.content.content_type);
  });

  // Multimodal assistant responses
  const multimodalMessages = group.messages.filter((tn) => {
    const msg = tn.node.message;
    return msg?.author.role === "assistant" &&
      msg.content.content_type === "multimodal_text" &&
      msg.recipient === "all";
  });

  // Get model slug and timestamp from first assistant message
  const firstAssistant = group.messages.find((tn) => tn.node.message?.author.role === "assistant");
  const modelSlug = firstAssistant?.node.message?.metadata?.model_slug as string | undefined;
  const timestamp = firstAssistant?.node.message?.create_time ?? null;

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-emerald-600 text-white">
        G
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold">ChatGPT</span>
          {modelSlug && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              {modelSlug}
            </span>
          )}
          {timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        <div className="text-sm leading-relaxed space-y-2">
          {/* Thinking blocks (collapsible) */}
          {thinkingMessages.map((tn) => (
            <ThinkingBlock key={tn.node.id} content={tn.node.message!.content} />
          ))}

          {/* Reasoning recap (if separate from thinking) */}
          {reasoningMessages.map((tn) => (
            <ContentRenderer
              key={tn.node.id}
              content={tn.node.message!.content}
              conversationId={conversationId}
            />
          ))}

          {/* Tool activity (collapsed summary) */}
          {toolMessages.length > 0 && (
            <ToolActivity messages={toolMessages} conversationId={conversationId} />
          )}

          {/* Main text responses */}
          {mainMessages.map((tn) => {
            const msg = tn.node.message!;
            return (
              <ContentRenderer
                key={tn.node.id}
                content={msg.content}
                conversationId={conversationId}
                contentReferences={msg.metadata?.content_references as unknown[] | undefined}
              />
            );
          })}

          {/* Multimodal responses */}
          {multimodalMessages.map((tn) => {
            const msg = tn.node.message!;
            return (
              <ContentRenderer
                key={tn.node.id}
                content={msg.content}
                conversationId={conversationId}
                contentReferences={msg.metadata?.content_references as unknown[] | undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Collapsible section showing tool activity within an assistant turn. */
function ToolActivity({
  messages,
  conversationId,
}: {
  messages: MessageGroupType["messages"];
  conversationId: string;
}) {
  const toolNames = [...new Set(
    messages
      .map((tn) => tn.node.message?.author.name)
      .filter(Boolean)
  )];

  const label = toolNames.length > 0
    ? `Used ${toolNames.join(", ")}`
    : `${messages.length} tool call${messages.length !== 1 ? "s" : ""}`;

  return (
    <details className="group">
      <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
        {label}
      </summary>
      <div className="mt-2 space-y-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
        {messages.map((tn) => {
          const msg = tn.node.message!;
          return (
            <div key={tn.node.id} className="text-xs text-gray-500 dark:text-gray-400">
              {msg.author.name && (
                <span className="font-mono text-purple-500 dark:text-purple-400 mr-1">
                  {msg.author.name}
                </span>
              )}
              <ContentRenderer
                content={msg.content}
                conversationId={conversationId}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}
