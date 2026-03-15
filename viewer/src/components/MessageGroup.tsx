import type { BundledLanguage } from "shiki";
import type { MessageGroup as MessageGroupType, ThreadNode } from "../lib/thread";
import { getModelDisplayName, isThinkingModel, formatThinkingEffort } from "../lib/models";
import { ContentRenderer } from "./ContentRenderer";
import { BranchSwitcher } from "./BranchSwitcher";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "./ai-elements/code-block";
import {
  Message,
  MessageContent,
} from "./ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  useReasoning,
} from "./ai-elements/reasoning";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CollapsibleContent } from "@/components/ui/collapsible";

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
  onSwitchBranch,
}: {
  group: MessageGroupType;
  conversationId: string;
  onSwitchBranch: (nodeId: string, newIndex: number) => void;
}) {
  if (group.role === "user") {
    const msg = group.messages[0]?.node.message;
    if (!msg) return null;

    const tn = group.messages[0];

    return (
      <Message from="user">
        <MessageContent>
          <ContentRenderer
            content={msg.content}
            conversationId={conversationId}
            contentReferences={msg.metadata?.content_references as unknown[] | undefined}
          />
        </MessageContent>
        <div className="flex items-center justify-end gap-2">
          {msg.create_time && (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(msg.create_time)}
            </span>
          )}
          <BranchSwitcher
            activeIndex={tn.activeChildIndex}
            totalChildren={tn.totalChildren}
            onSwitch={(idx) => onSwitchBranch(tn.node.id, idx)}
          />
        </div>
      </Message>
    );
  }

  // Render in order. Output text is always shown inline.
  // Non-output messages (thoughts, code, tool, reasoning_recap) accumulate
  // into collapsible process blocks. When we hit output, flush the process block.
  type Segment =
    | { type: "output"; tn: ThreadNode }
    | { type: "process"; messages: ThreadNode[] };

  const segments: Segment[] = [];
  let currentProcess: ThreadNode[] = [];

  for (const tn of group.messages) {
    const msg = tn.node.message;
    if (!msg) continue;
    const ct = msg.content.content_type;

    // Output = assistant text/multimodal visible to user, NOT commentary
    // Commentary text is "thinking aloud" preamble — goes in process block
    // Tool multimodal results (e.g. DALL-E images) are also treated as output
    const isAssistantOutput =
      msg.author.role === "assistant" &&
      (ct === "text" || ct === "multimodal_text") &&
      (msg.recipient ?? "all") === "all" &&
      msg.channel !== "commentary";
    const isToolImageOutput =
      msg.author.role === "tool" &&
      ct === "multimodal_text";
    const isOutput = isAssistantOutput || isToolImageOutput;

    if (isOutput) {
      if (currentProcess.length > 0) {
        segments.push({ type: "process", messages: currentProcess });
        currentProcess = [];
      }
      segments.push({ type: "output", tn });
    } else {
      currentProcess.push(tn);
    }
  }
  if (currentProcess.length > 0) {
    segments.push({ type: "process", messages: currentProcess });
  }

  // Get model slug and timestamp from first assistant message
  const firstAssistant = group.messages.find((tn) => tn.node.message?.author.role === "assistant");
  const meta = firstAssistant?.node.message?.metadata ?? {};
  const modelSlug = meta.model_slug as string | undefined;
  const timestamp = firstAssistant?.node.message?.create_time ?? null;
  const thinkingEffort = meta.thinking_effort as string | undefined;
  const thinking = modelSlug ? isThinkingModel(modelSlug) : false;

  return (
    <Message from="assistant">
      {/* Header */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-semibold">
          {modelSlug ? getModelDisplayName(modelSlug) : "ChatGPT"}
        </span>
        {thinking && (
          <span className="text-xs text-muted-foreground">
            Thinking{thinkingEffort ? ` · ${formatThinkingEffort(thinkingEffort)}` : ""}
          </span>
        )}
        {timestamp && (
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(timestamp)}
          </span>
        )}
      </div>

      <MessageContent>
        <div className="space-y-2">
          {segments.map((seg, i) => {
            if (seg.type === "process") {
              return <ProcessBlock key={i} messages={seg.messages} conversationId={conversationId} />;
            }
            const msg = seg.tn.node.message!;
            return (
              <ContentRenderer
                key={seg.tn.node.id}
                content={msg.content}
                conversationId={conversationId}
                contentReferences={msg.metadata?.content_references as unknown[] | undefined}
              />
            );
          })}
        </div>
      </MessageContent>
    </Message>
  );
}

/** A resolved search result for the ref index. */
interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
  attribution?: string;
  pub_date?: string | null;
}

/** Build lookup: "turn0search3" -> SearchResult from search_result_groups metadata. */
function buildSearchIndex(messages: ThreadNode[]): Map<string, SearchResult> {
  const index = new Map<string, SearchResult>();
  for (const tn of messages) {
    const meta = tn.node.message?.metadata;
    if (!meta) continue;
    const groups = meta.search_result_groups as unknown[];
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const g = group as Record<string, unknown>;
      const domain = g.domain as string | undefined;
      const entries = g.entries as Record<string, unknown>[] | undefined;
      if (!entries) continue;
      for (const entry of entries) {
        const refId = entry.ref_id as { turn_index: number; ref_type: string; ref_index: number } | undefined;
        if (refId) {
          const key = `turn${refId.turn_index}${refId.ref_type}${refId.ref_index}`;
          index.set(key, {
            title: String(entry.title ?? ""),
            url: String(entry.url ?? ""),
            snippet: entry.snippet as string | undefined,
            domain,
            attribution: entry.attribution as string | undefined,
            pub_date: entry.pub_date as string | null | undefined,
          });
        }
      }
    }
  }
  return index;
}

function ProcessBlockTriggerContent({ label }: { label: string }) {
  const { isOpen } = useReasoning();
  return (
    <>
      <span>{label}</span>
      <ChevronDownIcon
        className={cn(
          "size-4 transition-transform",
          isOpen ? "rotate-180" : "rotate-0"
        )}
      />
    </>
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
  // Build search result index from all tool messages' metadata
  const searchIndex = buildSearchIndex(messages);

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
    <Reasoning defaultOpen={false}>
      <ReasoningTrigger>
        <ProcessBlockTriggerContent label={label} />
      </ReasoningTrigger>
      <CollapsibleContent className="mt-2 space-y-3 text-sm text-muted-foreground data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in">
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
                      {t.summary && <span className="font-medium">{t.summary}: </span>}
                      {t.content}
                    </div>
                  ))}
                </div>
              );
            }

            // Tool calls (code sent to tool)
            if (role === "assistant" && ct === "code") {
              const toolContent = msg.content as unknown as Record<string, unknown>;
              const raw = String(toolContent.text ?? "");
              return <ToolCallDisplay key={tn.node.id} raw={raw} language={String(toolContent.language ?? "")} searchIndex={searchIndex} />;
            }

            // Tool results — render search_result_groups if present, otherwise raw text
            if (role === "tool") {
              const toolName = msg.author.name;
              const srg = msg.metadata?.search_result_groups as unknown[] | undefined;

              // If we have search_result_groups, render them as nice cards
              if (srg && Array.isArray(srg) && srg.length > 0) {
                return <SearchResultGroups key={tn.node.id} groups={srg} />;
              }

              // Multimodal tool results (e.g. DALL-E images) — use ContentRenderer
              if (ct === "multimodal_text") {
                return (
                  <div key={tn.node.id}>
                    {toolName && (
                      <div className="text-xs font-mono text-purple-500 dark:text-purple-400 mb-1">
                        {toolName}
                      </div>
                    )}
                    <ContentRenderer content={msg.content} conversationId={conversationId} />
                  </div>
                );
              }

              const text = (msg.content.parts ?? [])
                .filter((p): p is string => typeof p === "string")
                .join("\n");
              if (!text.trim()) return null;
              return (
                <div key={tn.node.id}>
                  {toolName && (
                    <div className="text-xs font-mono text-purple-500 dark:text-purple-400 mb-1">
                      {toolName}
                    </div>
                  )}
                  <div className="text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto">
                    {text}
                  </div>
                </div>
              );
            }

            // Reasoning recap
            if (ct === "reasoning_recap") {
              const rc = msg.content as unknown as Record<string, unknown>;
              return (
                <div key={tn.node.id} className="italic border-l-2 border-purple-400 pl-3">
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
      </CollapsibleContent>
    </Reasoning>
  );
}

/** Renders search result groups as collapsible compact cards. */
function SearchResultGroups({ groups }: { groups: unknown[] }) {
  const allEntries = (groups as Record<string, unknown>[]).flatMap((g) =>
    ((g.entries ?? []) as Record<string, unknown>[]).map((entry) => ({
      entry,
      domain: g.domain as string | undefined,
    }))
  );

  return (
    <details className="group">
      <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
        {allEntries.length} result{allEntries.length !== 1 ? "s" : ""}
      </summary>
      <div className="mt-2 space-y-1">
        {allEntries.map(({ entry, domain }, i) => {
          const refId = entry.ref_id as { turn_index: number; ref_type: string; ref_index: number } | undefined;
          const refKey = refId ? `turn${refId.turn_index}${refId.ref_type}${refId.ref_index}` : null;
          return (
            <div key={i} className="flex gap-2 text-xs py-1">
              {refKey && (
                <span className="shrink-0 font-mono text-gray-400 dark:text-gray-500 w-24 truncate" title={refKey}>
                  {refKey}
                </span>
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-700 dark:text-gray-300 truncate">
                  {String(entry.title ?? "")}
                </div>
                <div className="text-gray-400 dark:text-gray-500 truncate">
                  {domain ?? String(entry.url ?? "")}
                </div>
                {entry.snippet != null && (
                  <div className="text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                    {String(entry.snippet as string)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** Renders a tool call (code sent to a tool), parsing JSON nicely when possible. */
function ToolCallDisplay({ raw, language: _language, searchIndex }: { raw: string; language: string; searchIndex: Map<string, SearchResult> }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not JSON — show as-is
  }

  if (!parsed) {
    return (
      <CodeBlock code={raw} language={"text" as BundledLanguage}>
        <CodeBlockHeader>
          <CodeBlockTitle>code</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    );
  }

  // Search queries
  if (parsed.search_query && Array.isArray(parsed.search_query)) {
    const queries = parsed.search_query as { q: string; recency?: number }[];
    return (
      <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Searched {queries.length} quer{queries.length === 1 ? "y" : "ies"}
          {Object.entries(parsed).filter(([k]) => k !== "search_query").map(([k, v]) => (
            <span key={k} className="text-gray-400 dark:text-gray-500 ml-2">{k}: {String(v)}</span>
          ))}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {queries.map((sq, i) => {
            const extra = Object.entries(sq).filter(([k]) => k !== "q");
            return (
              <div key={i} className="px-3 py-2 text-xs">
                <div className="font-mono text-gray-700 dark:text-gray-300 break-all">{sq.q}</div>
                {extra.length > 0 && (
                  <div className="flex gap-3 mt-0.5 text-gray-400 dark:text-gray-500">
                    {extra.map(([k, v]) => (
                      <span key={k}>
                        {k}: {typeof v === "number" && k === "recency"
                          ? (v >= 365 ? `${Math.round(v / 365)}y` : v >= 30 ? `${Math.round(v / 30)}mo` : `${v}d`)
                          : String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Open/read search results
  if (parsed.open && Array.isArray(parsed.open)) {
    const refs = parsed.open as { ref_id: string; lineno?: number }[];
    const extra = Object.entries(parsed).filter(([k]) => k !== "open");
    return (
      <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Reading {refs.length} source{refs.length !== 1 ? "s" : ""}
          {extra.map(([k, v]) => (
            <span key={k} className="text-gray-400 dark:text-gray-500 ml-2">{k}: {String(v)}</span>
          ))}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {refs.map((ref, i) => {
            const resolved = searchIndex.get(ref.ref_id);
            return (
              <div key={i} className="px-3 py-2 text-xs">
                {resolved ? (
                  <div>
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                      {resolved.title}
                    </div>
                    <div className="text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {resolved.domain ?? resolved.url}
                    </div>
                  </div>
                ) : (
                  <span className="font-mono text-gray-600 dark:text-gray-400">
                    {ref.ref_id}
                    {ref.lineno != null && <span className="text-gray-400 ml-2">line {ref.lineno}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Python code execution
  if (parsed.jupyter_messages || parsed.code) {
    const codeText = String(parsed.code ?? raw);
    return (
      <CodeBlock code={codeText} language={"python" as BundledLanguage}>
        <CodeBlockHeader>
          <CodeBlockTitle>python</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    );
  }

  // Browser commands
  if (parsed.url || parsed.query) {
    return (
      <div className="rounded border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs">
        {parsed.query != null && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="font-mono text-gray-700 dark:text-gray-300">{String(parsed.query as string)}</span>
          </div>
        )}
        {parsed.url != null && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
            </svg>
            <span className="font-mono text-gray-700 dark:text-gray-300 break-all">{String(parsed.url as string)}</span>
          </div>
        )}
      </div>
    );
  }

  // Generic JSON — format nicely with key-value display
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Object.entries(parsed).map(([key, value]) => (
          <div key={key} className="px-3 py-1.5 text-xs flex gap-2">
            <span className="text-gray-400 dark:text-gray-500 shrink-0 font-mono">{key}</span>
            <span className="font-mono text-gray-700 dark:text-gray-300 break-all">
              {typeof value === "string" ? value : JSON.stringify(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
