import type { MessageContent } from "../lib/thread";

interface ReasoningRecapContent extends MessageContent {
  content_type: "reasoning_recap";
  content: string;
}

export function ReasoningRecap({ content }: { content: MessageContent }) {
  const rc = content as unknown as ReasoningRecapContent;
  const text =
    rc.content ??
    (rc.parts ?? []).filter((p): p is string => typeof p === "string").join("\n");

  return (
    <div className="my-2 border-l-3 border-purple-400 dark:border-purple-500 pl-4 py-2
      text-sm italic text-gray-500 dark:text-gray-400 leading-relaxed">
      <div className="not-italic font-medium text-xs uppercase tracking-wide text-purple-500 dark:text-purple-400 mb-1">
        Reasoning Summary
      </div>
      <div className="whitespace-pre-wrap">{text}</div>
    </div>
  );
}
