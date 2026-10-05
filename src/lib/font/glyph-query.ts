import type { GlyphEntry } from "./glyphs";
import { type GlyphCategory, generalCategory } from "./unicode-category";
import { formatCodepoint } from "./unicode-data";

export type CategoryFilter = GlyphCategory | "all";

export type SortKey = "unicode" | "glyphId" | "name" | "advanceWidth";

export type GlyphQuery = {
  search: string;
  category: CategoryFilter;
  script: string;
  sort: SortKey;
  direction: "asc" | "desc";
};

export const DEFAULT_GLYPH_QUERY: GlyphQuery = {
  search: "",
  category: "all",
  script: "all",
  sort: "unicode",
  direction: "asc",
};

export function categoryOf(glyph: GlyphEntry): GlyphCategory {
  if (glyph.codepoint === null) return "unassigned";
  return generalCategory(glyph.codepoint);
}

/**
 * Matches a glyph against what the user typed.
 *
 * A query can be the character itself, a code point in hex or decimal with or
 * without a `U+` prefix and zero padding, a glyph ID, or part of a glyph name.
 */
export function matchesSearch(glyph: GlyphEntry, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (query.length === 0) return true;

  if (glyph.char !== null && glyph.char.toLowerCase() === query) return true;

  if (glyph.name?.toLowerCase().includes(query)) return true;

  if (glyph.glyphId.toString() === query) return true;

  const cleaned = query
    .replace(/^u\+/, "")
    .replace(/^0x/, "")
    .replace(/^#/, "")
    .replace(/^0+/, "");

  if (cleaned.length > 0 && /^[0-9a-f]+$/.test(cleaned)) {
    const codepoint = Number.parseInt(cleaned, 16);
    if (glyph.codepoint === codepoint) return true;
    // A decimal entry point is the common case, so accept that too.
    const decimal = Number.parseInt(cleaned, 10);
    if (glyph.codepoint === decimal) return true;
  }

  for (const codepoint of glyph.codepoints) {
    if (formatCodepoint(codepoint).toLowerCase() === query) return true;
    if (formatCodepoint(codepoint).toLowerCase().includes(query)) return true;
  }

  return false;
}

function compare(a: GlyphEntry, b: GlyphEntry, sort: SortKey): number {
  switch (sort) {
    case "glyphId":
      return a.glyphId - b.glyphId;
    case "name":
      // Unnamed glyphs sort last, whichever direction is chosen.
      return (a.name ?? "￿").localeCompare(b.name ?? "￿");
    case "advanceWidth":
      return (a.advanceWidth ?? -1) - (b.advanceWidth ?? -1);
    case "unicode": {
      // Unmapped glyphs sort after mapped ones, then by code point.
      if (a.codepoint === null && b.codepoint === null) {
        return a.glyphId - b.glyphId;
      }
      if (a.codepoint === null) return 1;
      if (b.codepoint === null) return -1;
      if (a.codepoint !== b.codepoint) return a.codepoint - b.codepoint;
      return a.glyphId - b.glyphId;
    }
  }
}

export function filterGlyphs(
  glyphs: GlyphEntry[],
  query: GlyphQuery,
  scriptOf: (glyph: GlyphEntry) => string | undefined,
): GlyphEntry[] {
  const filtered = glyphs.filter((glyph) => {
    if (query.category !== "all" && categoryOf(glyph) !== query.category) {
      return false;
    }
    if (query.script !== "all" && scriptOf(glyph) !== query.script) {
      return false;
    }
    return matchesSearch(glyph, query.search);
  });

  const sorted = [...filtered].sort((a, b) => compare(a, b, query.sort));
  if (query.direction === "desc") sorted.reverse();
  return sorted;
}

/** Categories the font actually has glyphs in, for the filter chips. */
export function availableCategories(glyphs: GlyphEntry[]): {
  category: GlyphCategory;
  count: number;
}[] {
  const counts = new Map<GlyphCategory, number>();
  for (const glyph of glyphs) {
    const category = categoryOf(glyph);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Scripts the font actually has glyphs in, for the filter select. */
export function availableScripts(
  glyphs: GlyphEntry[],
  scriptOf: (glyph: GlyphEntry) => string | undefined,
): { script: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const glyph of glyphs) {
    const script = scriptOf(glyph);
    if (!script) continue;
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  return [...counts]
    .map(([script, count]) => ({ script, count }))
    .sort((a, b) => b.count - a.count);
}
