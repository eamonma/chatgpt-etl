import { useState } from "react";
import { useConversation } from "../hooks/useConversation";
import { MessageGroup } from "./MessageGroup";
import { CopyThreadButton } from "./CopyThreadButton";
import { MetadataPanel } from "./MetadataPanel";

export function ConversationView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { conversation, visibleThread, messageGroups, loading, error, handleSwitchBranch } =
    useConversation(conversationId);
  const [showMetadata, setShowMetadata] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading conversation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500">
        <p className="text-red-500">Error: {error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-medium truncate flex-1">
          {conversation?.title ?? "Conversation"}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <CopyThreadButton thread={visibleThread} title={conversation?.title ?? ""} />
          <button
            onClick={() => setShowMetadata((v) => !v)}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${showMetadata ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" : ""}`}
            title="Toggle metadata"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messageGroups.map((group, i) => (
              <MessageGroup
                key={i}
                group={group}
                conversationId={conversationId}
                onSwitchBranch={handleSwitchBranch}
              />
            ))}
          </div>
        </div>

        {/* Metadata panel */}
        {showMetadata && conversation && (
          <MetadataPanel conversation={conversation} />
        )}
      </div>
    </div>
  );
}
