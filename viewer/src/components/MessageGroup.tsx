import { useState } from "react";
import type { MessageGroup as MessageGroupType, ThreadNode } from "../lib/thread";
import { ContentRenderer } from "./ContentRenderer";

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

  // Assistant group: split into "process" (thinking/tools) and "output" (final response)
  const processMessages: ThreadNode[] = [];
  const outputMessages: ThreadNode[] = [];

  for (const tn of group.messages) {
    const msg = tn.node.message;
    if (!msg) continue;
    const ct = msg.content.content_type;

    const isOutput =
      (msg.author.role === "assistant" && ct === "text" && msg.recipient === "all") ||
      (msg.author.role === "assistant" && ct === "multimodal_text" && msg.recipient === "all");

    if (isOutput) {
      outputMessages.push(tn);
    } else {
      processMessages.push(tn);
    }
  }

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
          {/* Process block: thinking + tool calls, all in one collapsible */}
          {processMessages.length > 0 && (
            <ProcessBlock messages={processMessages} conversationId={conversationId} />
          )}

          {/* Final output */}
          {outputMessages.map((tn) => {
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

/**
 * Collapsible block showing the assistant's "thinking process":
 * thoughts, tool calls, tool results, reasoning recaps — all interleaved.
 */
function ProcessBlock({
  messages,
  conversationId,
}: {
  messages: ThreadNode[];
  conversationId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Build a summary label
  const toolNames = [...new Set(
    messages
      .filter((tn) => tn.node.message?.author.role === "tool")
      .map((tn) => tn.node.message?.author.name)
      .filter(Boolean)
  )];
  const hasThoughts = messages.some((tn) =>
    tn.node.message?.content.content_type === "thoughts"
  );

  let label = "Thinking";
  if (toolNames.length > 0) {
    label = hasThoughts
      ? `Thought and used ${toolNames.join(", ")}`
      : `Used ${toolNames.join(", ")}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400
          hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <svg
          className={`w-3 h-3 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        <span className="font-medium">{label}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50
          px-4 py-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          {messages.map((tn) => {
            const msg = tn.node.message!;
            const ct = msg.content.content_type;
            const role = msg.author.role;

            // Thoughts
            if (ct === "thoughts") {
              const raw = (msg.content as unknown as Record<string, unknown>).thoughts;
              const thoughts = Array.isArray(raw) ? raw as { summary: string; content: string }[] : [];
              if (thoughts.length === 0) return null;
              return (
                <div key={tn.node.id} className="space-y-2">
                  {thoughts.map((t, i) => (
                    <div key={i} className="whitespace-pre-wrap leading-relaxed">
                      {t.summary && <span className="font-medium text-gray-700 dark:text-gray-300">{t.summary}: </span>}
                      {t.content}
                    </div>
                  ))}
                </div>
              );
            }

            // Tool calls (code sent to tool)
            if (role === "assistant" && ct === "code") {
              const toolContent = msg.content as unknown as Record<string, unknown>;
              return (
                <div key={tn.node.id} className="font-mono text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">
                  {String(toolContent.text ?? "")}
                </div>
              );
            }

            // Tool results
            if (role === "tool") {
              const toolName = msg.author.name;
              const text = (msg.content.parts ?? [])
                .filter((p): p is string => typeof p === "string")
                .join("\n")
                .slice(0, 500);
              if (!text.trim()) return null;
              return (
                <div key={tn.node.id}>
                  {toolName && (
                    <div className="text-xs font-mono text-purple-500 dark:text-purple-400 mb-1">
                      {toolName}
                    </div>
                  )}
                  <div className="text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                    {text}{text.length >= 500 ? "..." : ""}
                  </div>
                </div>
              );
            }

            // Reasoning recap
            if (ct === "reasoning_recap") {
              const rc = msg.content as unknown as Record<string, unknown>;
              return (
                <div key={tn.node.id} className="italic text-gray-500 dark:text-gray-400 border-l-2 border-purple-400 pl-3">
                  {String(rc.content ?? "")}
                </div>
              );
            }

            // Anything else in the process block — render generically
            return (
              <ContentRenderer
                key={tn.node.id}
                content={msg.content}
                conversationId={conversationId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
