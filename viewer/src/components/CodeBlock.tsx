import { useState } from "react";
import type { MessageContent } from "../lib/thread";

export function CodeBlock({ content }: { content: MessageContent }) {
  const raw = content as unknown as Record<string, unknown>;
  const language = raw.language as string | undefined;
  const text = raw.text as string | undefined;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 text-xs">
        <span>{language ?? "code"}</span>
        <button
          onClick={handleCopy}
          className="hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto leading-relaxed">
        <code>{text ?? ""}</code>
      </pre>
    </div>
  );
}
