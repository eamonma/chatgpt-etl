import type { MessageContent } from "../lib/thread";

function extractFileId(assetPointer: string): string | null {
  // Format: sediment://file_{hex_id}
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
    <div>
      {parts.map((part, i) => {
        if (typeof part === "string") {
          return (
            <div key={i} style={{ whiteSpace: "pre-wrap" }}>
              {part}
            </div>
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
                style={{ maxWidth: "100%", borderRadius: "6px", marginTop: "4px" }}
              />
            );
          }
        }

        // Unknown object part — skip or render as debug info
        return null;
      })}
    </div>
  );
}
