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

export interface Footnote {
  title: string;
  url: string;
  attribution?: string;
  snippet?: string;
}

// Regex to match citation markers: \ue200cite\ue202...\ue201
// Also match unclosed markers at end of string (truncated text)
const CITE_PATTERN = /\ue200cite\ue202[^\ue201]+(\ue201|$)/g;

// Match entity patterns: \ue200entity\ue202...\ue201 (or unclosed at end)
const ENTITY_PATTERN = /\ue200entity\ue202[^\ue201]+(\ue201|$)/g;

// Match inline image patterns: \ue200i\ue202...\ue201 (or unclosed at end)
const IMAGE_PATTERN = /\ue200i\ue202[^\ue201]+(\ue201|$)/g;

// Catch-all: any remaining \ue200...\ue201 markers (or unclosed at end)
const GENERIC_MARKER = /\ue200[^\ue201]+(\ue201|$)/g;

// File references: {{file:file-XXXX}}
const FILE_REF_PATTERN = /\{\{file:(file-[a-zA-Z0-9]+)\}\}/g;

// Tether citations: 【123456†L10-L20】 or 【123456†screenshot】
const TETHER_PATTERN = /\u3010[^\u3011]+\u3011/g;

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

export type Segment =
  | { type: "text"; content: string }
  | { type: "citation"; footnoteIndices: number[] }
  | { type: "file"; fileId: string };

/**
 * Process text into segments of text and citations.
 * Text segments contain markdown. Citation segments contain indices into the footnotes array.
 */
export function processCitationsSegmented(
  text: string,
  contentReferences?: unknown[],
): { segments: Segment[]; footnotes: Footnote[] } {
  const footnotes: Footnote[] = [];
  const refMap = contentReferences ? buildRefMap(contentReferences) : new Map();

  // Replace entity and image markers (these become plain text / markdown)
  // Do NOT run the generic catch-all here — it would strip cite markers too.
  let entityProcessed = text.replace(ENTITY_PATTERN, (match) => {
    const ref = refMap.get(match);
    return ref?.alt ?? "";
  });
  entityProcessed = entityProcessed.replace(IMAGE_PATTERN, (match) => {
    const ref = refMap.get(match);
    return ref?.alt ?? "";
  });

  // Split text at citation markers, keeping track of what's text vs citation
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of entityProcessed.matchAll(CITE_PATTERN)) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    // Add text before this citation
    if (matchStart > lastIndex) {
      segments.push({ type: "text", content: entityProcessed.slice(lastIndex, matchStart) });
    }

    // Resolve this citation to footnote indices
    const ref = refMap.get(match[0]);
    if (ref?.items && ref.items.length > 0) {
      const indices: number[] = [];
      for (const item of ref.items) {
        let idx = footnotes.findIndex((f) => f.url === item.url);
        if (idx === -1) {
          idx = footnotes.length;
          footnotes.push({
            title: item.title,
            url: item.url,
            attribution: item.attribution,
            snippet: item.snippet,
          });
        }
        indices.push(idx);
      }
      segments.push({ type: "citation", footnoteIndices: indices });
    }

    lastIndex = matchEnd;
  }

  // Add remaining text
  if (lastIndex < entityProcessed.length) {
    segments.push({ type: "text", content: entityProcessed.slice(lastIndex) });
  }

  // If no citations were found, return a single text segment
  if (segments.length === 0) {
    segments.push({ type: "text", content: entityProcessed });
  }

  // Clean remaining unknown markers and file refs from text segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === "text") {
      seg.content = seg.content.replace(GENERIC_MARKER, (match) => {
        const ref = refMap.get(match);
        return ref?.alt ?? "";
      });
      // Split file refs into separate segments
      const parts: Segment[] = [];
      let remaining = seg.content;
      let fileMatch: RegExpExecArray | null;
      const fileRe = new RegExp(FILE_REF_PATTERN.source, "g");
      let lastIdx = 0;
      while ((fileMatch = fileRe.exec(remaining)) !== null) {
        if (fileMatch.index > lastIdx) {
          parts.push({ type: "text", content: remaining.slice(lastIdx, fileMatch.index) });
        }
        parts.push({ type: "file", fileId: fileMatch[1] });
        lastIdx = fileMatch.index + fileMatch[0].length;
      }
      if (parts.length > 0) {
        if (lastIdx < remaining.length) {
          parts.push({ type: "text", content: remaining.slice(lastIdx) });
        }
        segments.splice(i, 1, ...parts);
        i += parts.length - 1;
      }
      seg.content = seg.content.replace(TETHER_PATTERN, (match) => {
        const ref = refMap.get(match);
        if (ref) {
          const r = ref as unknown as { title?: string; url?: string };
          if (r.title && r.url) {
            let idx = footnotes.findIndex((f) => f.url === r.url);
            if (idx === -1) {
              idx = footnotes.length;
              footnotes.push({ title: r.title!, url: r.url! });
            }
            return `[${idx + 1}]`;
          }
        }
        return "";
      });
    }
  }

  return { segments, footnotes };
}

/**
 * Process text to replace citation markers with readable references.
 * Returns text with citations replaced by markdown-style superscript links.
 */
export function processCitations(
  text: string,
  contentReferences?: unknown[],
): { text: string; footnotes: Footnote[] } {
  const footnotes: Footnote[] = [];
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
    return ref?.alt ?? "";
  });

  // Replace inline image markers with markdown images from alt field
  processed = processed.replace(IMAGE_PATTERN, (match) => {
    const ref = refMap.get(match);
    return ref?.alt ?? "";
  });

  // Strip any remaining unknown markers
  processed = processed.replace(GENERIC_MARKER, (match) => {
    const ref = refMap.get(match);
    return ref?.alt ?? "";
  });

  // Replace {{file:file-XXX}} references with a readable label
  processed = processed.replace(FILE_REF_PATTERN, (_match, fileId: string) => {
    return `[Attached file: ${fileId}]`;
  });

  // Replace tether citations 【...†...】 with footnote references
  processed = processed.replace(TETHER_PATTERN, (match) => {
    const ref = refMap.get(match);
    if (ref) {
      const r = ref as unknown as { title?: string; url?: string };
      if (r.title && r.url) {
        let idx = footnotes.findIndex((f) => f.url === r.url);
        if (idx === -1) {
          idx = footnotes.length;
          footnotes.push({ title: r.title!, url: r.url! });
        }
        return `[${idx + 1}]`;
      }
    }
    return "";
  });

  return { text: processed, footnotes };
}
