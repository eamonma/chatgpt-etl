/**
 * ChatGPT citations use private-use Unicode delimiters:
 * - \ue200 = start marker
 * - \ue201 = end marker
 * - \ue202 = separator
 *
 * Citation pattern in text: \ue200cite\ue202turn0search3\ue202turn0search5\ue201
 *
 * content_references in metadata contain matched_text with the same pattern,
 * plus items[] with title, url, attribution for each source.
 */

export interface CitationRef {
  matched_text: string;
  type: string;
  items?: {
    title: string;
    url: string;
    attribution?: string;
    snippet?: string;
  }[];
  alt?: string;
  safe_urls?: string[];
}

export interface ProcessedCitation {
  sources: { title: string; url: string; attribution?: string }[];
}

// Regex to match citation markers: \ue200cite\ue202...\ue201
const CITE_PATTERN = /\ue200cite\ue202[^\ue201]+\ue201/g;

// Also match entity patterns: \ue200entity\ue202...\ue201
const ENTITY_PATTERN = /\ue200entity\ue202[^\ue201]+\ue201/g;

/**
 * Build a map from matched_text to citation data for quick lookup.
 */
function buildRefMap(contentReferences: unknown[]): Map<string, CitationRef> {
  const map = new Map<string, CitationRef>();
  for (const ref of contentReferences) {
    const r = ref as Record<string, unknown>;
    if (r.matched_text && typeof r.matched_text === "string") {
      map.set(r.matched_text, r as unknown as CitationRef);
    }
  }
  return map;
}

/**
 * Process text to replace citation markers with readable references.
 * Returns text with citations replaced by markdown-style superscript links.
 */
export function processCitations(
  text: string,
  contentReferences?: unknown[],
): { text: string; footnotes: { title: string; url: string; attribution?: string }[] } {
  const footnotes: { title: string; url: string; attribution?: string }[] = [];
  const refMap = contentReferences ? buildRefMap(contentReferences) : new Map();

  // Replace citation markers
  let processed = text.replace(CITE_PATTERN, (match) => {
    const ref = refMap.get(match);
    if (ref?.items && ref.items.length > 0) {
      const indices: number[] = [];
      for (const item of ref.items) {
        // Check if already in footnotes
        let idx = footnotes.findIndex((f) => f.url === item.url);
        if (idx === -1) {
          idx = footnotes.length;
          footnotes.push({ title: item.title, url: item.url, attribution: item.attribution });
        }
        indices.push(idx + 1);
      }
      return indices.map((i) => `[${i}]`).join("");
    }
    // No ref data — strip the marker
    return "";
  });

  // Replace entity markers (e.g. alt text for inline entities)
  processed = processed.replace(ENTITY_PATTERN, (match) => {
    const ref = refMap.get(match);
    if (ref?.alt) {
      return ref.alt;
    }
    return "";
  });

  return { text: processed, footnotes };
}
