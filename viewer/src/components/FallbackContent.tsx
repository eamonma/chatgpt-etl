import type { MessageContent } from "../lib/thread";

export function FallbackContent({ content }: { content: MessageContent }) {
  return (
    <div className="my-2">
      <div className="text-xs font-mono text-gray-400 mb-1">
        {content.content_type}
      </div>
      <pre className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400 overflow-x-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}
