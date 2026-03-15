import type { MappingNode, Message } from "../lib/thread";
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

export function MessageBubble({
  message,
  node: _node,
  conversationId,
}: {
  message: Message;
  node: MappingNode;
  conversationId: string;
}) {
  const role = message.author.role;
  const modelSlug = message.metadata?.model_slug as string | undefined;
  const toolName = message.author.name;
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
            <div className="text-sm">
              <ContentRenderer content={message.content} conversationId={conversationId} />
            </div>
          </div>
          {message.create_time && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
              {formatTimestamp(message.create_time)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant / Tool / System
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
        ${role === "assistant" ? "bg-emerald-600 text-white" :
          role === "tool" ? "bg-purple-600 text-white" :
          "bg-gray-500 text-white"}`}
      >
        {role === "assistant" ? "G" : role === "tool" ? "T" : "S"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold">
            {role === "assistant" ? "ChatGPT" : role === "tool" ? (toolName ?? "Tool") : "System"}
          </span>
          {modelSlug && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              {modelSlug}
            </span>
          )}
          {message.create_time && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTimestamp(message.create_time)}
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="text-sm leading-relaxed">
          <ContentRenderer content={message.content} conversationId={conversationId} />
        </div>
      </div>
    </div>
  );
}
