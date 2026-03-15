const MODEL_NAMES: Record<string, string> = {
  // GPT-5.4
  "gpt-5-4-thinking": "GPT-5.4",
  "gpt-5-4-pro": "GPT-5.4 Pro",

  // GPT-5.2
  "gpt-5-2-thinking": "GPT-5.2",
  "gpt-5-2-pro": "GPT-5.2 Pro",
  "gpt-5-2-instant": "GPT-5.2 Instant",
  "gpt-5-2": "GPT-5.2",

  // GPT-5.1
  "gpt-5-1-thinking": "GPT-5.1",
  "gpt-5-1-pro": "GPT-5.1 Pro",
  "gpt-5-1-instant": "GPT-5.1 Instant",
  "gpt-5-1": "GPT-5.1",

  // GPT-5
  "gpt-5": "GPT-5",
  "gpt-5-pro": "GPT-5 Pro",
  "gpt-5-instant": "GPT-5 Instant",
  "gpt-5-mini": "GPT-5 Mini",

  // GPT-4
  "gpt-4o": "GPT-4o",
  "gpt-4-1": "GPT-4.1",

  // Other
  "o3": "o3",
  "research": "Deep Research",
  "agent-mode": "Agent",
};

/**
 * Get a human-readable display name for a model slug.
 * Returns the slug itself if no mapping exists.
 */
export function getModelDisplayName(slug: string): string {
  return MODEL_NAMES[slug] ?? slug;
}
