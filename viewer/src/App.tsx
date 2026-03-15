import { useState } from "react";
import { ConversationList } from "./components/ConversationList";
import { ConversationView } from "./components/ConversationView";

export function App() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside
        className={`
          ${selectedConversationId ? "hidden md:flex" : "flex"}
          flex-col w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700
          bg-gray-50 dark:bg-gray-850 shrink-0
        `}
      >
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold">ChatGPT Archive</h1>
        </div>
        <ConversationList
          onSelect={setSelectedConversationId}
          selectedId={selectedConversationId}
        />
      </aside>

      {/* Main content */}
      <main className={`
        ${selectedConversationId ? "flex" : "hidden md:flex"}
        flex-col flex-1 min-w-0
      `}>
        {selectedConversationId ? (
          <ConversationView
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <p className="text-lg">Select a conversation</p>
          </div>
        )}
      </main>
    </div>
  );
}
