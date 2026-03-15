import type { MessageContent } from "../lib/thread";

interface SonicWebpageContent extends MessageContent {
  content_type: "sonic_webpage";
  url: string;
  domain: string;
  title: string;
  snippet: string;
  pub_date: string | null;
}

export function WebpageCard({ content }: { content: MessageContent }) {
  const wc = content as unknown as SonicWebpageContent;

  return (
    <div className="my-2 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="font-medium text-sm mb-1">{wc.title ?? "Untitled"}</div>
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-2">
        <span className="text-emerald-600 dark:text-emerald-400">{wc.domain}</span>
        {wc.pub_date && <span>&middot; {wc.pub_date}</span>}
      </div>
      {wc.snippet && (
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {wc.snippet}
        </div>
      )}
      {wc.url && (
        <div className="mt-2 text-xs text-gray-400 truncate">{wc.url}</div>
      )}
    </div>
  );
}
