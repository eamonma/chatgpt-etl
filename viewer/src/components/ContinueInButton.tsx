import { useCallback, useRef, useState } from "react";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import type { ThreadNode } from "../lib/thread";
import { formatThreadAsXml, collectFileIds, resolveFiles, type FormatMessage } from "../lib/format";

type Target = "claude" | "chatgpt";

const MAX_URL_LENGTH = 6000;

const TARGET_CONFIG: Record<Target, { label: string; baseUrl: string }> = {
  claude: { label: "Claude", baseUrl: "https://claude.ai/new?q=" },
  chatgpt: { label: "ChatGPT", baseUrl: "https://chatgpt.com/?q=" },
};

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

export function ContinueInButton({
  thread,
  title,
  conversationId,
  target,
}: {
  thread: ThreadNode[];
  title: string;
  conversationId: string;
  target: Target;
}) {
  const [copied, setCopied] = useState(false);
  const hovering = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const config = TARGET_CONFIG[target];

  const scheduleReset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!hovering.current) {
        setCopied(false);
      }
    }, 3000);
  }, []);

  const handleClick = async () => {
    const messages = threadToMessages(thread);
    const fileIds = collectFileIds(messages);
    const resolved = fileIds.length > 0 ? await resolveFiles(conversationId, fileIds) : undefined;
    const xml = formatThreadAsXml(messages, title, resolved);
    const encoded = encodeURIComponent(xml);
    const url = config.baseUrl + encoded;

    if (url.length <= MAX_URL_LENGTH) {
      window.open(url, "_blank");
    } else {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      toast.info("Conversation copied to clipboard", {
        description: `Too long to prefill — paste it in ${config.label}`,
        action: {
          label: `Open ${config.label}`,
          onClick: () => window.open(config.baseUrl, "_blank"),
        },
      });
      scheduleReset();
    }
  };

  // Wrap in a stable container so pointer events persist across button/link swap
  return (
    <span
      className="inline-flex"
      onPointerEnter={() => {
        hovering.current = true;
        clearTimeout(timerRef.current);
      }}
      onPointerLeave={() => {
        hovering.current = false;
        if (copied) scheduleReset();
      }}
    >
      {copied ? (
        <a
          href={config.baseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-500 hover:text-emerald-400 hover:bg-foreground/5 transition-colors"
          title={`Copied — open ${config.label} and paste`}
        >
          <CheckIcon className="size-3.5" />
          Paste in {config.label}
        </a>
      ) : (
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          title={`Continue in ${config.label}`}
        >
          <ExternalLinkIcon className="size-3.5" />
          {config.label}
        </button>
      )}
    </span>
  );
}
