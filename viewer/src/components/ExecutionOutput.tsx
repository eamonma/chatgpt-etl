import type { MessageContent } from "../lib/thread";

export function ExecutionOutput({ content }: { content: MessageContent }) {
  const text = (content as unknown as Record<string, unknown>).text as string | undefined;

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
        Output
      </div>
      <pre className="p-4 bg-gray-50 dark:bg-gray-850 text-sm overflow-x-auto font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
        {text ?? ""}
      </pre>
    </div>
  );
}
