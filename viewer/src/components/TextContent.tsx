import { useMemo } from "react";
import type { MessageContent } from "../lib/thread";
import { processCitations } from "../lib/citations";
import { MessageResponse } from "./ai-elements/message";

export function TextContent({
  content,
  contentReferences,
}: {
  content: MessageContent;
  contentReferences?: unknown[];
}) {
  const rawText = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  const { text, footnotes } = useMemo(
    () => processCitations(rawText, contentReferences),
    [rawText, contentReferences],
  );

  if (!text.trim() && footnotes.length === 0) return null;

  return (
    <div>
      <MessageResponse>{text}</MessageResponse>

      {footnotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            {footnotes.map((fn, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="shrink-0">[{i + 1}]</span>
                <span>
                  <a
                    href={fn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {fn.title}
                  </a>
                  {fn.attribution && (
                    <span className="text-muted-foreground"> — {fn.attribution}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
