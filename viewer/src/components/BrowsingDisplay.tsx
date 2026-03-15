import type { MessageContent } from "../lib/thread";

interface BrowsingContent extends MessageContent {
  content_type: "tether_browsing_display";
  result: string;
  summary: string | null;
}

export function BrowsingDisplay({ content }: { content: MessageContent }) {
  const bc = content as unknown as BrowsingContent;
  const result = bc.result ?? "";
  const summary = bc.summary ?? null;

  return (
    <div className="my-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        Web browsing result
      </div>
      <div className="px-4 py-3 text-sm">
        {summary && (
          <div className="mb-2 text-gray-500 dark:text-gray-400 italic">{summary}</div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
          {result}
        </div>
      </div>
    </div>
  );
}
