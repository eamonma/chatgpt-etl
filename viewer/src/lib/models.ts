interface ModelInfo {
  name: string;
  thinking: boolean;
}

const MODELS: Record<string, ModelInfo> = {
  // GPT-5.4
  "gpt-5-4-thinking": { name: "GPT-5.4", thinking: true },
  "gpt-5-4-pro": { name: "GPT-5.4 Pro", thinking: true },

  // GPT-5.2
  "gpt-5-2-thinking": { name: "GPT-5.2", thinking: true },
  "gpt-5-2-pro": { name: "GPT-5.2 Pro", thinking: true },
  "gpt-5-2-instant": { name: "GPT-5.2 Instant", thinking: false },
  "gpt-5-2": { name: "GPT-5.2", thinking: false },

  // GPT-5.1
  "gpt-5-1-thinking": { name: "GPT-5.1", thinking: true },
  "gpt-5-1-pro": { name: "GPT-5.1 Pro", thinking: true },
  "gpt-5-1-instant": { name: "GPT-5.1 Instant", thinking: false },
  "gpt-5-1": { name: "GPT-5.1", thinking: false },

  // GPT-5
  "gpt-5": { name: "GPT-5", thinking: false },
  "gpt-5-pro": { name: "GPT-5 Pro", thinking: true },
  "gpt-5-instant": { name: "GPT-5 Instant", thinking: false },
  "gpt-5-mini": { name: "GPT-5 Mini", thinking: false },

  // GPT-4
  "gpt-4o": { name: "GPT-4o", thinking: false },
  "gpt-4-1": { name: "GPT-4.1", thinking: false },

  // Other
  "o3": { name: "o3", thinking: true },
  "research": { name: "Deep Research", thinking: true },
  "agent-mode": { name: "Agent", thinking: false },
};

/**
 * Get a human-readable display name for a model slug.
 * Returns the slug itself if no mapping exists.
 */
export function getModelDisplayName(slug: string): string {
  return MODELS[slug]?.name ?? slug;
}

/** Whether this model supports extended thinking. */
export function isThinkingModel(slug: string): boolean {
  return MODELS[slug]?.thinking ?? (slug.includes("thinking") || slug.includes("pro"));
}

/** Format thinking effort level for display. */
export function formatThinkingEffort(effort: string): string {
  switch (effort) {
    case "extended": return "Extended";
    case "high": return "High";
    case "medium": return "Medium";
    case "low": return "Low";
    default: return effort;
  }
}
