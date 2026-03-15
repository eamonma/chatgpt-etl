import type { MessageContent } from "../lib/thread";
import { TextContent } from "./TextContent";
import { CodeBlock } from "./CodeBlock";
import { ExecutionOutput } from "./ExecutionOutput";
import { ThinkingBlock } from "./ThinkingBlock";
import { MultimodalContent } from "./MultimodalContent";
import { BrowsingDisplay } from "./BrowsingDisplay";
import { WebpageCard } from "./WebpageCard";
import { ReasoningRecap } from "./ReasoningRecap";
import { ComputerOutput } from "./ComputerOutput";
import { SystemError } from "./SystemError";
import { FallbackContent } from "./FallbackContent";

const HIDDEN_TYPES = new Set(["user_editable_context", "model_editable_context"]);

export function ContentRenderer({
  content,
  conversationId,
}: {
  content: MessageContent;
  conversationId: string;
}) {
  const ct = content.content_type;

  if (HIDDEN_TYPES.has(ct)) {
    return null;
  }

  switch (ct) {
    case "text":
      return <TextContent content={content} />;
    case "code":
      return <CodeBlock content={content} />;
    case "execution_output":
      return <ExecutionOutput content={content} />;
    case "thoughts":
      return <ThinkingBlock content={content} />;
    case "multimodal_text":
      return <MultimodalContent content={content} conversationId={conversationId} />;
    case "tether_browsing_display":
      return <BrowsingDisplay content={content} />;
    case "sonic_webpage":
      return <WebpageCard content={content} />;
    case "reasoning_recap":
      return <ReasoningRecap content={content} />;
    case "computer_output":
      return <ComputerOutput content={content} />;
    case "system_error":
      return <SystemError content={content} />;
    default:
      return <FallbackContent content={content} />;
  }
}
