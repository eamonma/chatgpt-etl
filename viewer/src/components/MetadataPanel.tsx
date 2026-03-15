import type { ConversationFile } from "../types";

export function MetadataPanel({
  conversation,
}: {
  conversation: ConversationFile;
}) {
  // Extract top-level metadata (everything except mapping which is huge)
  const { mapping: _mapping, ...meta } = conversation;

  return (
    <div className="w-80 border-l border-border overflow-hidden bg-secondary/30 shrink-0 hidden lg:flex flex-col">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">Metadata</h3>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </div>
    </div>
  );
}
