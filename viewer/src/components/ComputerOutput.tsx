import type { MessageContent } from "../lib/thread";

interface ComputerOutputContent extends MessageContent {
  content_type: "computer_output";
  computer_id: string;
  screenshot: string;
  tether_id: string;
  state: string;
  is_ephemeral: boolean;
}

export function ComputerOutput({ content }: { content: MessageContent }) {
  const co = content as unknown as ComputerOutputContent;
  const state = co.state ?? "";
  const computerId = co.computer_id ?? "";
  const hasScreenshot = Boolean(co.screenshot);
  const isEphemeral = co.is_ephemeral ?? false;

  return (
    <div
      style={{
        border: "1px solid #555",
        borderRadius: "6px",
        padding: "12px",
        background: "#0a0a0a",
        color: "#a0a0a0",
        fontSize: "0.875rem",
        borderLeft: "3px solid #666",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: "8px",
          color: "#ccc",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={{ fontFamily: "monospace" }}>&#x1F5A5;</span> Computer Output
        {computerId && (
          <span style={{ fontSize: "0.75rem", color: "#666" }}>({computerId})</span>
        )}
      </div>
      {state && (
        <div
          style={{
            fontFamily: "monospace",
            padding: "8px",
            background: "#111",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        >
          State: {state}
        </div>
      )}
      <div style={{ fontSize: "0.8rem", color: "#666" }}>
        {hasScreenshot
          ? "Screenshot captured (binary data not displayed)"
          : "No screenshot available"}
        {isEphemeral && " \u00b7 ephemeral"}
      </div>
    </div>
  );
}
