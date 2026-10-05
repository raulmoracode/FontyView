import type { Glyph, Path } from "opentype.js";
import { parse as parseOpenType } from "opentype.js";
import { BinaryReader } from "./binary-reader";
import { buildCmap, parseCmap } from "./cmap";
import {
  buildSfnt,
  type ContainerInfo,
  decodeWoff,
  extractFromCollection,
  readContainerInfo,
  readOutlineFormat,
  readSfntDirectory,
  type SfntDirectory,
  type TablePayload,
} from "./container";
import { FontAnalysisError } from "./errors";
import {
  type NameRecord,
  parseHead,
  parseHhea,
  parseMaxp,
  parseName,
  parseOs2,
} from "./tables/core";
import {
  emptyRawGlyph,
  parseLoca,
  parseRawGlyph,
  type RawGlyph,
} from "./tables/glyf";
import { type KerningData, readKerning } from "./tables/kerning";
import { type LayoutTable, parseLayoutTable } from "./tables/layout";
import { type GlyphMetric, parseHmtx, parsePost } from "./tables/metrics";
import { decodeWoff2 } from "./woff2";

export type UnpackedFont = {
  container: ContainerInfo;
  directory: SfntDirectory;
  bytes: Uint8Array;
  /** Lazily populated opentype.js font, used only for outlines. */
  opentypeFont: () => import("opentype.js").Font;
};

function tableBytes(font: Uint8Array, directory: SfntDirectory, tag: string) {
  const entry = directory.tables.find((table) => table.tag === tag);
  if (!entry) return null;
  return font.subarray(entry.offset, entry.offset + entry.length);
}

/** Unpacks any supported container into a plain sfnt buffer. */
export async function unpackFont(bytes: Uint8Array): Promise<ArrayBuffer> {
  const container = readContainerInfo(bytes);

  switch (container.format) {
    case "ttf":
    case "otf":
      return toArrayBuffer(bytes);
    case "ttc":
    case "otc":
      return extractFromCollection(bytes, 0);
    case "woff":
      return await decodeWoff(bytes);
    case "woff2":
      return await decodeWoff2(bytes);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/**
 * Loads an unpacked font for outline extraction.
 *
 * The `cmap` table is replaced with one synthesised from the parsed mapping.
 * Real fonts ship subtables that strict consumers reject (format 6 Mac Roman
 * being the common one), and we need the outlines to stay reachable.
 */
export function createUnpackedFont(sfnt: ArrayBuffer): UnpackedFont {
  const bytes = new Uint8Array(sfnt);
  const container: ContainerInfo = {
    format: "ttf",
    label: "sfnt",
    flavor: 0x0001_0000,
  };
  const directory = readSfntDirectory(bytes);

  let font: import("opentype.js").Font | null = null;
  return {
    container,
    directory,
    bytes,
    opentypeFont: () => {
      font ??= parseOpenType(withCompatibleCmap(bytes, directory));
      return font;
    },
  };
}

function withCompatibleCmap(
  bytes: Uint8Array,
  directory: SfntDirectory,
): ArrayBuffer {
  const cmapEntry = directory.tables.find((table) => table.tag === "cmap");
  if (!cmapEntry) return toArrayBuffer(bytes);

  const original = bytes.subarray(
    cmapEntry.offset,
    cmapEntry.offset + cmapEntry.length,
  );
  const { mapping } = parseCmap(original);
  const rebuilt = buildCmap(mapping);

  const payloads: TablePayload[] = directory.tables.map((table) => {
    if (table.tag !== "cmap") {
      return {
        tag: table.tag,
        data: bytes.subarray(table.offset, table.offset + table.length),
      };
    }
    return { tag: "cmap", data: rebuilt };
  });

  return buildSfnt(directory.flavor, payloads);
}

export type FontStructure = {
  directory: SfntDirectory;
  head: ReturnType<typeof parseHead> | null;
  hhea: ReturnType<typeof parseHhea> | null;
  maxp: ReturnType<typeof parseMaxp> | null;
  os2: ReturnType<typeof parseOs2> | null;
  post: ReturnType<typeof parsePost> | null;
  names: NameRecord[];
  numGlyphs: number;
  metrics: GlyphMetric[];
  /** `loca` offsets, only for TrueType-outline fonts. */
  loca: Uint32Array | null;
  /** Present only when the font has a GSUB or GPOS table. */
  layout: LayoutTable[];
  kerning: KerningData;
  tableSizes: { tag: string; length: number }[];
};

export function readFontStructure(font: UnpackedFont): FontStructure {
  const { bytes, directory } = font;
  const tableSizes = directory.tables.map((table) => ({
    tag: table.tag,
    length: table.length,
  }));

  const headBytes = tableBytes(bytes, directory, "head");
  const hheaBytes = tableBytes(bytes, directory, "hhea");
  const maxpBytes = tableBytes(bytes, directory, "maxp");
  const os2Bytes = tableBytes(bytes, directory, "OS/2");
  const postBytes = tableBytes(bytes, directory, "post");
  const nameBytes = tableBytes(bytes, directory, "name");
  const hmtxBytes = tableBytes(bytes, directory, "hmtx");

  const head = headBytes ? parseHead(headBytes) : null;
  const hhea = hheaBytes ? parseHhea(hheaBytes) : null;
  const maxp = maxpBytes ? parseMaxp(maxpBytes) : null;
  const os2 = os2Bytes ? parseOs2(os2Bytes) : null;
  const numGlyphs = maxp?.numGlyphs ?? 0;

  const post = postBytes ? parsePost(postBytes, numGlyphs) : null;
  const names = nameBytes ? parseName(nameBytes) : [];
  const metrics =
    hmtxBytes && hhea
      ? parseHmtx(hmtxBytes, hhea.numberOfHMetrics, numGlyphs)
      : [];

  const layout: LayoutTable[] = [];
  for (const kind of ["GSUB", "GPOS"] as const) {
    const raw = tableBytes(bytes, directory, kind);
    if (!raw) continue;
    try {
      layout.push(parseLayoutTable(raw, kind));
    } catch {
      // A damaged layout table should not invalidate the rest of the font.
    }
  }

  const isTrueType = directory.tables.some((table) => table.tag === "glyf");
  const locaBytes = tableBytes(bytes, directory, "loca");
  const loca =
    isTrueType && locaBytes && head
      ? parseLoca(locaBytes, head.indexToLocFormat, numGlyphs)
      : null;

  const kernTable = tableBytes(bytes, directory, "kern");
  const gposTable = tableBytes(bytes, directory, "GPOS");
  const kerning = readKerning(
    kernTable,
    gposTable ? { gpos: gposTable, lookupListOffset: 0 } : null,
  );

  return {
    directory,
    head,
    hhea,
    maxp,
    os2,
    post,
    names,
    numGlyphs,
    metrics,
    loca,
    layout,
    kerning,
    tableSizes,
  };
}

export type GlyphSource = {
  structure: FontStructure;
  font: UnpackedFont;
  /** Cached raw `glyf` records, indexed by glyph ID. */
  rawCache: Map<number, RawGlyph>;
  glyfBytes: Uint8Array | null;
};

export function createGlyphSource(
  structure: FontStructure,
  font: UnpackedFont,
): GlyphSource {
  const glyfEntry = structure.directory.tables.find(
    (table) => table.tag === "glyf",
  );
  const glyfBytes = glyfEntry
    ? font.bytes.subarray(glyfEntry.offset, glyfEntry.offset + glyfEntry.length)
    : null;

  return {
    structure,
    font,
    glyfBytes,
    rawCache: new Map(),
  };
}

/**
 * Raw outline data for a glyph.
 *
 * TrueType fonts expose real contours, points and components. CFF/CFF2 fonts
 * only expose the Type 2 charstring path, so those come from opentype.js.
 */
export function readRawGlyph(source: GlyphSource, glyphId: number): RawGlyph {
  const cached = source.rawCache.get(glyphId);
  if (cached) return cached;

  let glyph: RawGlyph = emptyRawGlyph(glyphId);
  const { glyfBytes } = source;
  const { loca } = source.structure;
  if (glyfBytes && loca && glyphId + 1 < loca.length) {
    try {
      glyph = parseRawGlyph(
        glyfBytes,
        loca[glyphId],
        loca[glyphId + 1],
        glyphId,
      );
    } catch {
      glyph = emptyRawGlyph(glyphId);
    }
  }
  source.rawCache.set(glyphId, glyph);
  return glyph;
}

export type OutlineGlyph = {
  glyphId: number;
  /** SVG path data in font units, Y up. */
  path: string;
  commands: import("opentype.js").PathCommand[];
  advanceWidth: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

export function readOutline(
  source: GlyphSource,
  glyphId: number,
): OutlineGlyph | null {
  const metric = source.structure.metrics[glyphId];
  let path: Path | null = null;

  try {
    const font = source.font.opentypeFont();
    path = font.glyphs.get(glyphId)?.getPath() ?? null;
  } catch {
    path = null;
  }

  if (!path) return null;

  const box = path.getBoundingBox();
  return {
    glyphId,
    path: path.toPathData(2),
    commands: path.commands,
    advanceWidth: metric?.advanceWidth ?? 0,
    xMin: box.x1,
    yMin: box.y1,
    xMax: box.x2,
    yMax: box.y2,
  };
}

export function glyphForCharacter(
  source: GlyphSource,
  codepoint: number,
): Glyph | null {
  try {
    const char = String.fromCodePoint(codepoint);
    return source.font.opentypeFont().charToGlyph(char);
  } catch {
    return null;
  }
}

export { BinaryReader, FontAnalysisError, readOutlineFormat };
