import type { MessageContent } from "../lib/thread";

interface SystemErrorContent extends MessageContent {
  content_type: "system_error";
  name: string;
  text: string;
}

export function SystemError({ content }: { content: MessageContent }) {
  const se = content as unknown as SystemErrorContent;
  const name = se.name ?? "Error";
  const text =
    se.text ??
    (se.parts ?? []).filter((p): p is string => typeof p === "string").join("\n");

  return (
    <div className="my-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
      <div className="font-medium text-sm text-red-600 dark:text-red-400 mb-1">
        {name}
      </div>
      <pre className="text-sm font-mono text-red-500 dark:text-red-400 whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
