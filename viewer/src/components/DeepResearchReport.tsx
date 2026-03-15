import { useMemo } from "react";
import { TextContent } from "./TextContent";
import type { MessageContent } from "../lib/thread";
import { CheckCircle2Icon, CircleDotIcon, CircleIcon, ClockIcon } from "lucide-react";

interface PlanStep {
  id: string;
  text: string;
  status: string;
  reason?: string | null;
}

interface Plan {
  title: string;
  steps: PlanStep[];
}

interface ReportMessage {
  content: { content_type: string; parts?: (string | Record<string, unknown>)[] };
  metadata?: { content_references?: unknown[] };
}

interface WidgetState {
  plan?: Plan;
  report_message?: ReportMessage;
  status?: string;
  research_started_at?: string;
  research_stopped_at?: string;
}

/**
 * Try to extract a deep research widget state from a tool message's metadata.
 * Returns null if this isn't a deep research node.
 */
export function extractDeepResearchState(
  metadata: Record<string, unknown>,
): WidgetState | null {
  const sdk = metadata?.chatgpt_sdk as Record<string, unknown> | undefined;
  if (!sdk) return null;

  const raw = sdk.widget_state;
  if (!raw) return null;

  try {
    const ws: WidgetState = typeof raw === "string" ? JSON.parse(raw) : raw;
    // Must have a report_message to be a completed deep research
    if (!ws.report_message) return null;
    return ws;
  } catch {
    return null;
  }
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2Icon className="size-4 text-green-500 shrink-0" />;
    case "in_progress":
      return <CircleDotIcon className="size-4 text-blue-500 shrink-0 animate-pulse" />;
    default:
      return <CircleIcon className="size-4 text-muted-foreground/40 shrink-0" />;
  }
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins === 1) return "1 min";
  return `${mins} mins`;
}

export function DeepResearchReport({
  widgetState,
  conversationId,
}: {
  widgetState: WidgetState;
  conversationId: string;
}) {
  const { plan, report_message, research_started_at, research_stopped_at } = widgetState;

  const duration = useMemo(() => {
    if (research_started_at && research_stopped_at) {
      return formatDuration(research_started_at, research_stopped_at);
    }
    return null;
  }, [research_started_at, research_stopped_at]);

  return (
    <div className="space-y-4">
      {/* Plan */}
      {plan && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Deep Research</span>
            {duration && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ClockIcon className="size-3" />
                {duration}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {plan.steps.map((step) => (
              <div key={step.id} className="flex items-start gap-2 text-sm">
                <StepIcon status={step.status} />
                <span className={step.status === "pending" ? "text-muted-foreground" : ""}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      {report_message && (
        <TextContent
          content={report_message.content as MessageContent}
          contentReferences={report_message.metadata?.content_references}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}
