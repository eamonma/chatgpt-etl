import { useState } from "react";
import type { MessageContent } from "../lib/thread";

interface Thought {
  summary: string;
  content: string;
  finished: boolean;
}

export function ThinkingBlock({ content }: { content: MessageContent }) {
  const [expanded, setExpanded] = useState(false);

  const raw = (content as unknown as Record<string, unknown>).thoughts;
  let thoughts: Thought[] = [];
  if (Array.isArray(raw)) {
    // Already parsed array (most common in real data)
    thoughts = raw as Thought[];
  } else if (typeof raw === "string") {
    try {
      thoughts = JSON.parse(raw) as Thought[];
    } catch {
      thoughts = [{ summary: "", content: raw, finished: true }];
    }
  }

  return (
    <div className="my-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400
          hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        <span className="font-medium">Thinking...</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700
          bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400 space-y-3">
          {thoughts.map((t, i) => (
            <div key={i}>
              {t.summary && (
                <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.summary}
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">{t.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
