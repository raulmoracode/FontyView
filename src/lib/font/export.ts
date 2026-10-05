import type { LoadedFont } from "./analyze";
import type { GlyphEntry } from "./glyphs";
import { buildGlyphList } from "./glyphs";

/**
 * The parts of the analysis a JSON export can include. Excluding a part is
 * cheaper than filtering the result afterwards, and it makes the choice
 * explicit rather than implied by a missing key.
 */
export const EXPORT_SECTIONS = [
  "metadata",
  "tables",
  "metrics",
  "unicode",
  "scripts",
  "features",
  "kerning",
  "ligatures",
  "variable",
  "glyphs",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export const SECTION_LABELS: Record<ExportSection, string> = {
  metadata: "Metadata",
  tables: "Tables",
  metrics: "Metrics",
  unicode: "Unicode coverage",
  scripts: "Scripts",
  features: "OpenType features",
  kerning: "Kerning",
  ligatures: "Ligatures",
  variable: "Variation axes",
  glyphs: "Glyphs",
};

export const DEFAULT_SECTIONS: ExportSection[] = [
  "metadata",
  "tables",
  "metrics",
  "unicode",
  "features",
  "kerning",
  "variable",
];

export type ExportReport = {
  generator: string;
  exportedAt: string;
  file: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tables?: unknown;
  metrics?: Record<string, unknown>;
  unicode?: Record<string, unknown>;
  scripts?: unknown;
  features?: unknown;
  kerning?: Record<string, unknown>;
  ligatures?: unknown;
  variable?: unknown;
  glyphs?: unknown;
};

function mappingToPairs(mapping: Map<number, number>): [number, number][] {
  return [...mapping].sort((a, b) => a[0] - b[0]);
}

/**
 * Builds the export from the parsed analysis.
 *
 * The font's own bytes are deliberately absent: an analysis is already a
 * description of the font, and embedding the binary again would make the file
 * large and pointless. Everything here is plain JSON, with the few `Map`s the
 * parsers use turned into sorted arrays so the output is stable between runs.
 */
export function buildExport(
  loaded: LoadedFont,
  sections: ExportSection[],
  glyphs?: GlyphEntry[],
): ExportReport {
  const { analysis, structure, cmap } = loaded;
  const wanted = new Set(sections);
  const report: ExportReport = {
    generator: "FontyView",
    exportedAt: new Date().toISOString(),
    file: {
      name: analysis.file.fileName,
      size: analysis.file.fileSize,
      format: analysis.file.format,
      container: analysis.file.label,
      outlines: analysis.outlineFormat,
      unitsPerEm: analysis.unitsPerEm,
      encodedCharacters: analysis.statistics.unicodePoints,
    },
  };

  if (wanted.has("metadata")) {
    report.metadata = {
      ...analysis.metadata,
      statistics: analysis.statistics,
    } as unknown as Record<string, unknown>;
  }

  if (wanted.has("tables")) {
    report.tables = {
      count: structure.directory.tables.length,
      entries: structure.tableSizes,
    };
  }

  if (wanted.has("metrics")) {
    const ascender = structure.hhea?.ascender ?? null;
    const descender = structure.hhea?.descender ?? null;
    report.metrics = {
      unitsPerEm: structure.head?.unitsPerEm ?? null,
      ascender,
      descender,
      lineGap: structure.hhea?.lineGap ?? null,
      capHeight: structure.os2?.sCapHeight ?? null,
      xHeight: structure.os2?.sxHeight ?? null,
      weightClass: structure.os2?.usWeightClass ?? null,
      widthClass: structure.os2?.usWidthClass ?? null,
      italicAngle: structure.post?.italicAngle ?? null,
      underlinePosition: structure.post?.underlinePosition ?? null,
      underlineThickness: structure.post?.underlineThickness ?? null,
      isFixedPitch: structure.post?.isFixedPitch ?? null,
      names: structure.names,
    };
  }

  if (wanted.has("unicode")) {
    report.unicode = {
      subtables: cmap.subtables,
      format: cmap.format,
      platformId: cmap.platformId,
      encodingId: cmap.encodingId,
      encodedCharacters: cmap.mapping.size,
      variationSelectors: [...cmap.variations].map(([selector, sequences]) => ({
        selector,
        sequences,
      })),
      mapping: mappingToPairs(cmap.mapping),
    };
  }

  if (wanted.has("scripts")) {
    report.scripts = analysis.scripts;
  }

  if (wanted.has("features")) {
    report.features = structure.layout.map((table) => ({
      table: table.kind,
      scripts: table.scripts,
      features: table.features,
      lookups: table.lookups.map((lookup) => ({
        type: lookup.lookupType,
        flag: lookup.lookupFlag,
        extension: lookup.isExtension,
      })),
    }));
  }

  if (wanted.has("kerning")) {
    report.kerning = {
      sources: structure.kerning.sources,
      counts: structure.kerning.counts,
      pairs: [...structure.kerning.pairs.values()].map((pair) => ({
        left: pair.left,
        right: pair.right,
        value: pair.value,
      })),
    };
  }

  if (wanted.has("ligatures")) {
    const gsub = structure.layout.find((table) => table.kind === "GSUB");
    report.ligatures = {
      present: gsub !== undefined,
      // Sorted so the same font always produces the same file.
      items: [...(gsub?.ligatures ?? [])]
        .map((ligature) => ({
          glyph: ligature.glyphId,
          components: ligature.components,
          lookup: ligature.lookupIndex,
        }))
        .sort(
          (a, b) =>
            a.glyph - b.glyph ||
            a.components.length - b.components.length ||
            a.lookup - b.lookup,
        ),
    };
  }

  if (wanted.has("variable")) {
    report.variable = structure.variation;
  }

  if (wanted.has("glyphs")) {
    const list = glyphs ?? buildGlyphList(structure, cmap.mapping);
    report.glyphs = {
      count: list.length,
      items: list.map((glyph) => ({
        id: glyph.glyphId,
        name: glyph.name,
        unicode:
          glyph.codepoint === null
            ? null
            : `U+${glyph.codepoint
                .toString(16)
                .toUpperCase()
                .padStart(4, "0")}`,
        advanceWidth: glyph.advanceWidth,
        leftSideBearing: glyph.leftSideBearing,
      })),
    };
  }

  return report;
}

/** The export as JSON text, ready to be written to a file. */
export function serializeExport(report: ExportReport, pretty: boolean): string {
  return pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
}

/**
 * A file name from the font's own name, so a folder of exports is
 * recognisable. Anything unusable in the name is replaced rather than dropped.
 */
export function exportFileName(loaded: LoadedFont): string {
  const base =
    loaded.analysis.metadata.postScriptName ||
    loaded.analysis.file.fileName ||
    "font";
  const safe = base
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe || "font"}-analysis.json`;
}
