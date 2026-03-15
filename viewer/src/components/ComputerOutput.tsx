import type { MessageContent } from "../lib/thread";

interface ComputerOutputContent extends MessageContent {
  content_type: "computer_output";
  computer_id: string;
  state: string;
  screenshot: string;
  is_ephemeral: boolean;
}

export function ComputerOutput({ content }: { content: MessageContent }) {
  const co = content as unknown as ComputerOutputContent;

  return (
    <div className="my-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
        Computer Output
        {co.computer_id && <span className="text-gray-400">({co.computer_id})</span>}
      </div>
      <div className="px-4 py-3">
        {co.state && (
          <pre className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-2">
            State: {co.state}
          </pre>
        )}
        <div className="text-xs text-gray-400">
          {co.screenshot ? "Screenshot captured" : "No screenshot"}
          {co.is_ephemeral && " (ephemeral)"}
        </div>
      </div>
    </div>
  );
}
