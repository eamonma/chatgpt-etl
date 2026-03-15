import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BundledLanguage } from "shiki";
import type { MessageContent } from "../lib/thread";
import { processCitationsSegmented, type Footnote } from "../lib/citations";
import { MessageResponse } from "./ai-elements/message";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
} from "./ai-elements/sources";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "./ai-elements/code-block";
import { FileCard } from "./FileCard";
import { MermaidDiagram } from "./MermaidDiagram";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractFileIdFromPointer(pointer: string): string | null {
  const match = pointer.match(/sediment:\/\/(file_[a-fA-F0-9]+)/);
  return match ? match[1] : null;
}

/** Unique placeholders using private-use Unicode that markdown won't touch */
const CITE_PLACEHOLDER = "\uf8f0CITE_";
const CITE_PLACEHOLDER_END = "\uf8f1";
const CITE_PLACEHOLDER_RE = /\uf8f0CITE_([\d,]+)\uf8f1/g;
const FILE_PLACEHOLDER = "\uf8f0FILE_";
const FILE_PLACEHOLDER_RE = /\uf8f0FILE_([^\uf8f1]+)\uf8f1/g;

function CitationBadge({
  footnoteIndices,
  footnotes,
  conversationId,
}: {
  footnoteIndices: number[];
  footnotes: Footnote[];
  conversationId?: string;
}) {
  const sources = footnoteIndices.map((i) => footnotes[i]).filter(Boolean);
  if (sources.length === 0) return null;

  const firstSource = sources[0];
  const label = sources.length > 1
    ? `${getHostname(firstSource.url)} +${sources.length - 1}`
    : getHostname(firstSource.url);

  return (
    <span className="inline-flex mx-0.5 align-baseline">
      <HoverCard openDelay={0} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Badge
            className="cursor-pointer rounded-full text-[10px] px-1.5 py-0"
            variant="secondary"
          >
            {label}
          </Badge>
        </HoverCardTrigger>
        <HoverCardContent className="w-80 p-0" align="start" sideOffset={0}>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {sources.map((source, i) => {
              const screenshotFileId = source.screenshotPointer
                ? extractFileIdFromPointer(source.screenshotPointer)
                : null;
              return (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 hover:bg-secondary/50 transition-colors"
                >
                  {screenshotFileId && conversationId && (
                    <img
                      src={`/api/assets/${conversationId}/${screenshotFileId}`}
                      alt={source.title}
                      className="w-full rounded mb-2"
                      loading="lazy"
                    />
                  )}
                  <div className="font-medium text-sm truncate">{source.title}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {getHostname(source.url)}
                  </div>
                  {source.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {source.snippet}
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        </HoverCardContent>
      </HoverCard>
    </span>
  );
}

/**
 * Expand children that may contain citation/file placeholders into
 * React elements. Splits a string on placeholder patterns and returns
 * a mixed array of strings and React components.
 */
function expandPlaceholders(
  children: React.ReactNode,
  footnotes: Footnote[],
  conversationId?: string,
): React.ReactNode {
  if (typeof children !== "string") return children;

  const combined = new RegExp(
    `\\uf8f0CITE_([\\d,]+)\\uf8f1|\\uf8f0FILE_([^\\uf8f1]+)\\uf8f1`,
    "g",
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }

    if (match[1] != null) {
      // Citation match
      const indices = match[1].split(",").map(Number);
      parts.push(
        <CitationBadge
          key={`cite-${match.index}`}
          footnoteIndices={indices}
          footnotes={footnotes}
          conversationId={conversationId}
        />,
      );
    } else if (match[2] != null) {
      // File match
      if (conversationId) {
        parts.push(
          <FileCard
            key={`file-${match.index}`}
            fileId={match[2]}
            conversationId={conversationId}
          />,
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) return children;
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }
  return parts;
}

export function TextContent({
  content,
  contentReferences,
  conversationId,
}: {
  content: MessageContent;
  contentReferences?: unknown[];
  conversationId?: string;
}) {
  const rawText = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  const { segments, footnotes } = useMemo(
    () => processCitationsSegmented(rawText, contentReferences),
    [rawText, contentReferences],
  );

  const hasAnyCitations = segments.some((s) => s.type === "citation");
  const hasAnyFiles = segments.some((s) => s.type === "file");

  // No citations or files — render with MessageResponse (full Streamdown)
  if (!hasAnyCitations && !hasAnyFiles) {
    const text = segments.map((s) => s.type === "text" ? s.content : "").join("");
    if (!text.trim()) return null;
    return <MessageResponse>{text}</MessageResponse>;
  }

  // Build a single markdown string with placeholders for citations/files
  const markdownWithPlaceholders = segments.map((seg) => {
    if (seg.type === "text") return seg.content;
    if (seg.type === "citation") {
      return `${CITE_PLACEHOLDER}${seg.footnoteIndices.join(",")}${CITE_PLACEHOLDER_END}`;
    }
    if (seg.type === "file") {
      return `${FILE_PLACEHOLDER}${seg.fileId}${CITE_PLACEHOLDER_END}`;
    }
    return "";
  }).join("");

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              const lang = className?.replace("language-", "") ?? "text";
              const codeText = String(children).replace(/\n$/, "");
              if (lang === "mermaid") {
                return <MermaidDiagram code={codeText} />;
              }
              return (
                <CodeBlock code={codeText} language={lang as BundledLanguage} className="my-2">
                  <CodeBlockHeader>
                    <CodeBlockTitle>{lang}</CodeBlockTitle>
                    <CodeBlockActions>
                      <CodeBlockCopyButton />
                    </CodeBlockActions>
                  </CodeBlockHeader>
                </CodeBlock>
              );
            }
            return (
              <code className="bg-secondary px-1.5 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          // Intercept text nodes to expand citation/file placeholders
          p: ({ children, ...props }) => (
            <p {...props}>
              {Array.isArray(children)
                ? children.map((child, i) => (
                    <React.Fragment key={i}>
                      {expandPlaceholders(child, footnotes, conversationId)}
                    </React.Fragment>
                  ))
                : expandPlaceholders(children, footnotes, conversationId)
              }
            </p>
          ),
          li: ({ children, ...props }) => (
            <li {...props}>
              {Array.isArray(children)
                ? children.map((child, i) => (
                    <React.Fragment key={i}>
                      {expandPlaceholders(child, footnotes, conversationId)}
                    </React.Fragment>
                  ))
                : expandPlaceholders(children, footnotes, conversationId)
              }
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong {...props}>
              {Array.isArray(children)
                ? children.map((child, i) => (
                    <React.Fragment key={i}>
                      {expandPlaceholders(child, footnotes, conversationId)}
                    </React.Fragment>
                  ))
                : expandPlaceholders(children, footnotes, conversationId)
              }
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em {...props}>
              {Array.isArray(children)
                ? children.map((child, i) => (
                    <React.Fragment key={i}>
                      {expandPlaceholders(child, footnotes, conversationId)}
                    </React.Fragment>
                  ))
                : expandPlaceholders(children, footnotes, conversationId)
              }
            </em>
          ),
        }}
      >
        {markdownWithPlaceholders}
      </ReactMarkdown>

      {footnotes.length > 0 && (
        <Sources className="mt-3">
          <SourcesTrigger count={footnotes.length} />
          <SourcesContent>
            {footnotes.map((fn, i) => (
              <a
                key={i}
                href={fn.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <span className="font-medium truncate">{fn.title}</span>
                {fn.attribution && (
                  <span className="text-muted-foreground text-xs"> — {fn.attribution}</span>
                )}
              </a>
            ))}
          </SourcesContent>
        </Sources>
      )}
    </div>
  );
}
