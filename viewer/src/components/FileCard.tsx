import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileTextIcon, ChevronDownIcon, ChevronUpIcon, DownloadIcon } from "lucide-react";
import { processCitations } from "../lib/citations";

interface FileCardProps {
  fileId: string;
  conversationId: string;
}

export function FileCard({ fileId, conversationId }: FileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkdown, setIsMarkdown] = useState(false);

  const resolveUrl = `/api/assets/${conversationId}/resolve/${fileId}`;

  // Eagerly fetch just the filename on mount via HEAD request
  useEffect(() => {
    fetch(resolveUrl, { method: "HEAD" })
      .then((res) => {
        const name = res.headers.get("X-File-Name") ?? fileId;
        setFileName(name);
        setIsMarkdown(name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt"));
      })
      .catch(() => {
        // Silently fall back to fileId display
      });
  }, [resolveUrl, fileId]);

  // Fetch full content when expanded
  useEffect(() => {
    if (!expanded || content !== null) return;

    setLoading(true);
    fetch(resolveUrl)
      .then(async (res) => {
        const name = res.headers.get("X-File-Name") ?? fileId;
        setFileName(name);
        setIsMarkdown(name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt"));

        if (!res.ok) {
          setError(`File not found (${res.status})`);
          return;
        }
        const text = await res.text();
        setContent(text);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [expanded, content, resolveUrl, fileId]);

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
      >
        <FileTextIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">
          {fileName ?? fileId}
        </span>
        {expanded ? (
          <ChevronUpIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {loading && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              Loading...
            </div>
          )}
          {error && (
            <div className="px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {content !== null && (
            <>
              <div className="px-4 py-3 max-h-[32rem] overflow-y-auto text-sm">
                {isMarkdown ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {processCitations(content).text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {processCitations(content).text}
                  </pre>
                )}
              </div>
              <div className="px-4 py-2 border-t border-border bg-secondary/30 flex items-center justify-end">
                <a
                  href={resolveUrl}
                  download={fileName ?? fileId}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
