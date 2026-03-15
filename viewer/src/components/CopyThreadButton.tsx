import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
      title="Copy thread as XML"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-500" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
