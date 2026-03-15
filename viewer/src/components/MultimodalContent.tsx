import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageContent } from "../lib/thread";

function extractFileId(assetPointer: string): string | null {
  const match = assetPointer.match(/sediment:\/\/(file_[a-fA-F0-9]+)/);
  return match ? match[1] : null;
}

export function MultimodalContent({
  content,
  conversationId,
}: {
  content: MessageContent;
  conversationId: string;
}) {
  const parts = content.parts ?? [];

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (typeof part === "string") {
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
              {part}
            </ReactMarkdown>
          );
        }

        const obj = part as Record<string, unknown>;
        if (obj.content_type === "image_asset_pointer") {
          const pointer = obj.asset_pointer as string | undefined;
          const fileId = pointer ? extractFileId(pointer) : null;
          if (fileId) {
            return (
              <img
                key={i}
                src={`/api/assets/${conversationId}/${fileId}`}
                alt=""
                className="max-w-full rounded-lg mt-2"
                loading="lazy"
              />
            );
          }
        }

        if (obj.content_type === "audio_transcription") {
          return (
            <div key={i} className="italic text-gray-500 dark:text-gray-400">
              [Audio: {(obj.text as string) ?? "transcription"}]
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
