import type { ConversationFile } from "../types";

export function MetadataPanel({
  conversation,
}: {
  conversation: ConversationFile;
}) {
  // Extract top-level metadata (everything except mapping which is huge)
  const { mapping: _mapping, ...meta } = conversation;

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900 shrink-0 hidden lg:block">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold">Metadata</h3>
      </div>
      <div className="p-4">
        <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </div>
    </div>
  );
}
