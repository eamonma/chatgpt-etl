import { useState } from "react";
import type { ThreadNode } from "../lib/thread";
import { formatThreadAsXml, type FormatMessage } from "../lib/format";

export function CopyThreadButton({
  thread,
  title,
}: {
  thread: ThreadNode[];
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const messages: FormatMessage[] = thread
      .filter((tn) => tn.node.message != null)
      .map((tn) => {
        const msg = tn.node.message!;
        return {
          role: msg.author.role,
          recipient: msg.recipient ?? "all",
          contentType: msg.content.content_type,
          parts: (msg.content.parts ?? []) as (string | Record<string, unknown>)[],
        };
      });

    const xml = formatThreadAsXml(messages, title);
    navigator.clipboard.writeText(xml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      title="Copy thread as XML"
    >
      {copied ? (
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
