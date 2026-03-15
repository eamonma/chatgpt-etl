import { useConversation } from "../hooks/useConversation";
import { MessageBubble } from "./MessageBubble";

export function ConversationView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { conversation, visibleThread, loading, error } =
    useConversation(conversationId);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>Loading conversation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
        <button onClick={onBack} style={{ marginTop: 8 }}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 16,
            padding: "4px 8px",
          }}
        >
          &larr; Back
        </button>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          {conversation?.title ?? "Conversation"}
        </h2>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {visibleThread.map((threadNode) => {
          const msg = threadNode.node.message;
          if (msg == null) return null;
          return (
            <MessageBubble
              key={threadNode.node.id}
              message={msg}
              node={threadNode.node}
              conversationId={conversationId}
            />
          );
        })}
      </div>
    </div>
  );
}
