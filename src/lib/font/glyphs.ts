import type { FontStructure } from "./font-source";
import type { GlyphMetric } from "./tables/metrics";
import { formatCodepoint } from "./unicode-data";

/**
 * One entry per glyph in the font, in glyph ID order.
 *
 * Built once per analysis: the glyph viewer, search and detail panel all read
 * this list rather than walking the binary again.
 */
export type GlyphEntry = {
  glyphId: number;
  /** First code point mapped to this glyph, or null when it encodes nothing. */
  codepoint: number | null;
  /** Every code point mapped to this glyph. */
  codepoints: number[];
  /** Character to render, or null for unmapped glyphs. */
  char: string | null;
  /** `post` glyph name, when the font provides one. */
  name: string | null;
  advanceWidth: number | null;
  leftSideBearing: number | null;
};

function safeChar(codepoint: number): string | null {
  try {
    return String.fromCodePoint(codepoint);
  } catch {
    return null;
  }
}

export function buildGlyphList(
  structure: FontStructure,
  mapping: Map<number, number>,
): GlyphEntry[] {
  const byGlyph = new Map<number, number[]>();
  for (const [codepoint, glyphId] of mapping) {
    const list = byGlyph.get(glyphId) ?? [];
    list.push(codepoint);
    byGlyph.set(glyphId, list);
  }

  const postNames = structure.post?.glyphNames ?? null;
  const metricFor = (glyphId: number): GlyphMetric | undefined =>
    structure.metrics[glyphId];

  const entries: GlyphEntry[] = [];
  for (let glyphId = 0; glyphId < structure.numGlyphs; glyphId++) {
    const codepoints = (byGlyph.get(glyphId) ?? []).sort((a, b) => a - b);
    const codepoint = codepoints[0] ?? null;
    const metric = metricFor(glyphId);
    entries.push({
      glyphId,
      codepoint,
      codepoints,
      char: codepoint === null ? null : safeChar(codepoint),
      name: postNames?.[glyphId] || null,
      advanceWidth: metric?.advanceWidth ?? null,
      leftSideBearing: metric?.leftSideBearing ?? null,
    });
  }

  return entries;
}

export function unicodeLabel(codepoint: number | null): string {
  return codepoint === null ? "—" : formatCodepoint(codepoint);
}
