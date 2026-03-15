import type { MessageContent } from "../lib/thread";
import { TextContent } from "./TextContent";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "./ai-elements/code-block";
import {
  Terminal,
  TerminalHeader,
  TerminalTitle,
  TerminalActions,
  TerminalCopyButton,
  TerminalContent,
} from "./ai-elements/terminal";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "./ai-elements/reasoning";
import { MultimodalContent } from "./MultimodalContent";
import { BrowsingDisplay } from "./BrowsingDisplay";
import { WebpageCard } from "./WebpageCard";
import { SystemError } from "./SystemError";
import { FallbackContent } from "./FallbackContent";

const HIDDEN_TYPES = new Set(["user_editable_context", "model_editable_context"]);

export interface ContentRendererProps {
  content: MessageContent;
  conversationId: string;
  contentReferences?: unknown[];
}

export function ContentRenderer({
  content,
  conversationId,
  contentReferences,
}: ContentRendererProps) {
  const ct = content.content_type;

  if (HIDDEN_TYPES.has(ct)) {
    return null;
  }

  switch (ct) {
    case "text":
      return <TextContent content={content} contentReferences={contentReferences} conversationId={conversationId} />;
    case "code": {
      const raw = content as unknown as Record<string, unknown>;
      const language = (raw.language as string) ?? "text";
      const text = (raw.text as string) ?? "";
      return (
        <CodeBlock code={text} language={language as import("shiki").BundledLanguage}>
          <CodeBlockHeader>
            <CodeBlockTitle>{language}</CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton />
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlock>
      );
    }
    case "execution_output": {
      const outputText = String((content as unknown as Record<string, unknown>).text ?? "");
      return (
        <Terminal output={outputText}>
          <TerminalHeader>
            <TerminalTitle>Output</TerminalTitle>
            <TerminalActions>
              <TerminalCopyButton />
            </TerminalActions>
          </TerminalHeader>
          <TerminalContent />
        </Terminal>
      );
    }
    case "thoughts": {
      const raw = (content as unknown as Record<string, unknown>).thoughts;
      let thoughts: { summary: string; content: string }[] = [];
      if (Array.isArray(raw)) {
        thoughts = raw as typeof thoughts;
      } else if (typeof raw === "string") {
        try { thoughts = JSON.parse(raw); } catch { thoughts = [{ summary: "", content: raw }]; }
      }
      const thinkingText = thoughts
        .map((t) => (t.summary ? `**${t.summary}**\n${t.content}` : t.content))
        .join("\n\n");
      return (
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>{thinkingText}</ReasoningContent>
        </Reasoning>
      );
    }
    case "multimodal_text":
      return <MultimodalContent content={content} conversationId={conversationId} contentReferences={contentReferences} />;
    case "tether_browsing_display":
      return <BrowsingDisplay content={content} />;
    case "sonic_webpage":
      return <WebpageCard content={content} />;
    case "reasoning_recap": {
      const rc = content as unknown as Record<string, unknown>;
      const recapText =
        (rc.content as string) ??
        ((rc.parts ?? []) as unknown[]).filter((p): p is string => typeof p === "string").join("\n");
      return (
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger
            getThinkingMessage={() => <p>Reasoning summary</p>}
          />
          <ReasoningContent>{recapText}</ReasoningContent>
        </Reasoning>
      );
    }
    case "computer_output": {
      const co = content as unknown as Record<string, unknown>;
      const parts = [
        co.state ? `State: ${co.state}` : null,
        co.screenshot ? "Screenshot captured" : "No screenshot",
        co.is_ephemeral ? "(ephemeral)" : null,
      ].filter(Boolean).join("\n");
      const title = co.computer_id ? `Computer Output (${co.computer_id})` : "Computer Output";
      return (
        <Terminal output={parts}>
          <TerminalHeader>
            <TerminalTitle>{title}</TerminalTitle>
            <TerminalActions>
              <TerminalCopyButton />
            </TerminalActions>
          </TerminalHeader>
          <TerminalContent />
        </Terminal>
      );
    }
    case "system_error":
      return <SystemError content={content} />;
    default:
      return <FallbackContent content={content} />;
  }
}
