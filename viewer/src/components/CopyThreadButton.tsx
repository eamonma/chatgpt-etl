import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ThreadNode } from "../lib/thread";
import { formatThreadAsXml, collectFileIds, resolveFiles, type FormatMessage } from "../lib/format";

function threadToMessages(thread: ThreadNode[]): FormatMessage[] {
  return thread
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
}

export function CopyThreadButton({
  thread,
  title,
  conversationId,
}: {
  thread: ThreadNode[];
  title: string;
  conversationId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const messages = threadToMessages(thread);
    const fileIds = collectFileIds(messages);
    const resolved = fileIds.length > 0 ? await resolveFiles(conversationId, fileIds) : undefined;
    const xml = formatThreadAsXml(messages, title, resolved);
    await navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
