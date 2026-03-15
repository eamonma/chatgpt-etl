import { useState } from "react";
import { Link } from "react-router-dom";
import { useConversation } from "../hooks/useConversation";
import { MessageGroup } from "./MessageGroup";
import { CopyThreadButton } from "./CopyThreadButton";
import { ContinueInButton } from "./ContinueInButton";
import { MetadataPanel } from "./MetadataPanel";
import {
  Conversation,
  ConversationContent,
} from "./ai-elements/conversation";
import { Shimmer } from "./ai-elements/shimmer";
import { CopyIcon, InfoIcon, ChevronLeftIcon } from "lucide-react";

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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Shimmer>Loading conversation...</Shimmer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p className="text-destructive">Error: {error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages column */}
        <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6 max-w-3xl mx-auto px-4 py-6 pb-24">
              <Link
                to="/"
                className="md:hidden inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </Link>
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

          {/* Bottom fade + floating buttons */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 bg-gradient-to-b from-transparent via-background/90 to-background">
            <div className="h-20" />
            <div>
              <div className="max-w-3xl mx-auto px-4 pb-4 flex items-center justify-center gap-2 pointer-events-auto">
                <CopyThreadButton thread={visibleThread} title={conversation?.title ?? ""} conversationId={conversationId} />
                <ContinueInButton thread={visibleThread} title={conversation?.title ?? ""} conversationId={conversationId} target="claude" />
                <ContinueInButton thread={visibleThread} title={conversation?.title ?? ""} conversationId={conversationId} target="chatgpt" />
                <button
                  onClick={() => setShowMetadata((v) => !v)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    transition-colors
                    ${showMetadata
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    }
                  `}
                  title="Toggle metadata"
                >
                  <InfoIcon className="size-3.5" />
                  Metadata
                </button>
              </div>
            </div>
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
