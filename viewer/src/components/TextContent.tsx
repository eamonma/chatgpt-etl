import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageContent } from "../lib/thread";
import { processCitations } from "../lib/citations";

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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              const lang = className?.replace("language-", "") ?? "";
              return (
                <div className="my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 text-xs">
                    <span>{lang}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(String(children))}
                      className="hover:text-white transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>

      {footnotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
            {footnotes.map((fn, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">[{i + 1}]</span>
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
                    <span className="text-gray-400"> — {fn.attribution}</span>
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
