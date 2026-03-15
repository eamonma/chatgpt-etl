import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageContent } from "../lib/thread";

export function TextContent({ content }: { content: MessageContent }) {
  const text = (content.parts ?? [])
    .filter((p): p is string => typeof p === "string")
    .join("\n");

  if (!text.trim()) return null;

  return (
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
  );
}
