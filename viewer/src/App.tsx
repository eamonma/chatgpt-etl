import { useState } from "react";
import { ConversationList } from "./components/ConversationList";
import { ConversationView } from "./components/ConversationView";

export function App() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {selectedConversationId && (
          <button
            onClick={() => setSelectedConversationId(null)}
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
        )}
        <h1 style={{ margin: 0, fontSize: 18 }}>ChatGPT Viewer</h1>
      </header>

      <main style={{ flex: 1, overflow: "hidden" }}>
        {selectedConversationId == null ? (
          <ConversationList onSelect={setSelectedConversationId} />
        ) : (
          <ConversationView
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        )}
      </main>
    </div>
  );
}
