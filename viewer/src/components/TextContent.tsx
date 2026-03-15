import { useMemo } from "react";
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
import { FileCard } from "./FileCard";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function CitationBadge({
  footnoteIndices,
  footnotes,
}: {
  footnoteIndices: number[];
  footnotes: Footnote[];
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
          <div className="max-h-64 overflow-y-auto divide-y divide-border">
            {sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 hover:bg-secondary/50 transition-colors"
              >
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
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    </span>
  );
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

  // No citations or files — render everything with MessageResponse (full markdown)
  if (!hasAnyCitations && !hasAnyFiles) {
    const text = segments.map((s) => s.type === "text" ? s.content : "").join("");
    if (!text.trim()) return null;
    return <MessageResponse>{text}</MessageResponse>;
  }

  // Has citations or files — render segments sequentially.
  return (
    <div>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          if (!seg.content.trim()) return null;
          return <MessageResponse key={i}>{seg.content}</MessageResponse>;
        }
        if (seg.type === "file") {
          return conversationId ? (
            <FileCard key={i} fileId={seg.fileId} conversationId={conversationId} />
          ) : null;
        }
        return (
          <CitationBadge
            key={i}
            footnoteIndices={seg.footnoteIndices}
            footnotes={footnotes}
          />
        );
      })}

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
