import type { MappingNode, Message } from "../lib/thread";
import { ContentRenderer } from "./ContentRenderer";

function formatTimestamp(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function roleLabel(role: string): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "tool":
      return "Tool";
    case "system":
      return "System";
    default:
      return role;
  }
}

const roleBadgeColors: Record<string, string> = {
  user: "#2563eb",
  assistant: "#16a34a",
  tool: "#9333ea",
  system: "#666",
};

const bubbleBackgrounds: Record<string, string> = {
  user: "#1e293b",
  assistant: "#1a2e1a",
  tool: "#2a1a2e",
  system: "#222",
};

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
  const isUser = role === "user";
  const modelSlug = message.metadata?.model_slug as string | undefined;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          background: bubbleBackgrounds[role] ?? "#222",
          borderRadius: "12px",
          padding: "12px 16px",
        }}
      >
        {/* Header: role badge + model + timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
            fontSize: "0.75rem",
          }}
        >
          <span
            style={{
              background: roleBadgeColors[role] ?? "#555",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            {roleLabel(role)}
          </span>
          {modelSlug && (
            <span style={{ color: "#888", fontFamily: "monospace" }}>{modelSlug}</span>
          )}
          <span style={{ color: "#666" }}>{formatTimestamp(message.create_time)}</span>
        </div>

        {/* Content */}
        <ContentRenderer content={message.content} conversationId={conversationId} />
      </div>
    </div>
  );
}
