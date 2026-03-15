import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageContent } from "../lib/thread";
import { processCitations } from "../lib/citations";

function extractFileId(assetPointer: string): string | null {
  const match = assetPointer.match(/sediment:\/\/(file_[a-fA-F0-9]+)/);
  return match ? match[1] : null;
}

export function MultimodalContent({
  content,
  conversationId,
  contentReferences,
}: {
  content: MessageContent;
  conversationId: string;
  contentReferences?: unknown[];
}) {
  const parts = content.parts ?? [];

  // Collect all string parts, process citations once for footnotes
  const allText = parts.filter((p): p is string => typeof p === "string").join("\n");
  const { footnotes } = useMemo(
    () => processCitations(allText, contentReferences),
    [allText, contentReferences],
  );

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (typeof part === "string") {
          const { text: processed } = processCitations(part, contentReferences);
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
              {processed}
            </ReactMarkdown>
          );
        }

        const obj = part as Record<string, unknown>;
        if (obj.content_type === "image_asset_pointer") {
          const pointer = obj.asset_pointer as string | undefined;
          const fileId = pointer ? extractFileId(pointer) : null;
          if (fileId) {
            return (
              <img
                key={i}
                src={`/api/assets/${conversationId}/${fileId}`}
                alt=""
                className="max-w-full rounded-lg mt-2"
                loading="lazy"
              />
            );
          }
        }

        if (obj.content_type === "audio_transcription") {
          return (
            <div key={i} className="italic text-gray-500 dark:text-gray-400">
              [Audio: {(obj.text as string) ?? "transcription"}]
            </div>
          );
        }

        return null;
      })}

      {footnotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
            {footnotes.map((fn, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">[{i + 1}]</span>
                <a
                  href={fn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {fn.title}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
