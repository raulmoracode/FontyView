import { BinaryReader } from "./binary-reader";
import { FontAnalysisError } from "./errors";

export type CmapEncoding =
  | "unicode"
  | "macintosh"
  | "iso10646"
  | "windows"
  | "custom";

export interface CmapSubtable {
  platformId: number;
  platform: string;
  encodingId: number;
  encoding: string;
  kind: CmapEncoding;
  format: number;
  /** Higher is better when choosing the authoritative subtable. */
  preference: number;
  mapping: Map<number, number>;
}

export interface CmapAnalysis {
  subtables: CmapSubtable[];
  /** Best available character-to-glyph mapping. */
  mapping: Map<number, number>;
  /** Best available variation selector mapping (cmap format 14). */
  variations: Map<string, number[]>;
  format: number | null;
  platformId: number | null;
  encodingId: number | null;
}

function platformName(id: number): string {
  switch (id) {
    case 0:
      return "Unicode";
    case 1:
      return "Macintosh";
    case 2:
      return "ISO";
    case 3:
      return "Windows";
    case 4:
      return "Custom";
    default:
      return `Platform ${id}`;
  }
}

function encodingName(platformId: number, encodingId: number): string {
  if (platformId === 0) {
    switch (encodingId) {
      case 0:
        return "Unicode 1.0";
      case 1:
        return "Unicode 1.1";
      case 2:
        return "ISO/IEC 10646";
      case 3:
        return "Unicode 2.0+";
      case 4:
        return "Unicode 2.0+ Full repertoire";
      case 5:
        return "Unicode Variation Sequences";
      case 6:
        return "Unicode Full Repertoire";
      default:
        return `Unicode ${encodingId}`;
    }
  }
  if (platformId === 3) {
    switch (encodingId) {
      case 0:
        return "Symbol";
      case 1:
        return "Unicode BMP";
      case 2:
        return "ShiftJIS";
      case 3:
        return "PRC";
      case 4:
        return "Big5";
      case 5:
        return "Wansung";
      case 6:
        return "Johab";
      case 10:
        return "Unicode Full Repertoire";
      default:
        return `Windows ${encodingId}`;
    }
  }
  if (platformId === 1) return `Macintosh ${encodingId}`;
  if (platformId === 2) return `ISO ${encodingId}`;
  return `Encoding ${encodingId}`;
}

function encodingKind(platformId: number): CmapEncoding {
  if (platformId === 0) return "unicode";
  if (platformId === 1) return "macintosh";
  if (platformId === 2) return "iso10646";
  if (platformId === 3) return "windows";
  return "custom";
}

function readFormat0(reader: BinaryReader): Map<number, number> {
  reader.skip(4); // length, language
  const mapping = new Map<number, number>();
  for (let code = 0; code < 256; code++) {
    const glyphId = reader.uint8();
    if (glyphId !== 0) mapping.set(code, glyphId);
  }
  return mapping;
}

function readFormat4(reader: BinaryReader): Map<number, number> {
  const length = reader.uint16();
  const end = reader.position + length - 4;
  reader.skip(2); // language

  const segCountX2 = reader.uint16();
  const segCount = segCountX2 >> 1;
  reader.skip(6); // searchRange, entrySelector, rangeShift

  const endCodes: number[] = [];
  for (let i = 0; i < segCount; i++) endCodes.push(reader.uint16());
  reader.skip(2); // reservedPad
  const startCodes: number[] = [];
  for (let i = 0; i < segCount; i++) startCodes.push(reader.uint16());
  const idDeltas: number[] = [];
  for (let i = 0; i < segCount; i++) idDeltas.push(reader.int16());

  const idRangeOffsetPosition = reader.position;
  const idRangeOffsets: number[] = [];
  for (let i = 0; i < segCount; i++) idRangeOffsets.push(reader.uint16());

  const mapping = new Map<number, number>();
  const view = new DataView(
    reader.bytes.buffer,
    reader.bytes.byteOffset,
    reader.bytes.byteLength,
  );

  for (let seg = 0; seg < segCount; seg++) {
    const start = startCodes[seg];
    const end = endCodes[seg];
    if (start === 0xffff) continue;

    for (let code = start; code <= end; code++) {
      let glyphId: number;
      if (idRangeOffsets[seg] === 0) {
        glyphId = (code + idDeltas[seg]) & 0xffff;
      } else {
        // idRangeOffset is a byte offset from its own slot in the array.
        const glyphPosition =
          idRangeOffsetPosition +
          seg * 2 +
          idRangeOffsets[seg] +
          (code - start) * 2;
        if (glyphPosition + 1 >= reader.length) continue;
        glyphId = view.getUint16(glyphPosition);
        if (glyphId !== 0) glyphId = (glyphId + idDeltas[seg]) & 0xffff;
      }
      if (glyphId !== 0) mapping.set(code, glyphId);
    }
  }
  reader.seek(end);
  return mapping;
}

function readFormat6(reader: BinaryReader): Map<number, number> {
  const length = reader.uint16();
  reader.skip(2); // language
  const firstCode = reader.uint16();
  const entryCount = reader.uint16();
  const mapping = new Map<number, number>();
  for (let i = 0; i < entryCount; i++) {
    const glyphId = reader.uint16();
    if (glyphId !== 0) mapping.set(firstCode + i, glyphId);
  }
  reader.seek(4 + length);
  return mapping;
}

function readFormat12(reader: BinaryReader): Map<number, number> {
  reader.skip(2 + 4 + 4); // reserved, length, language
  const groupCount = reader.uint32();
  const mapping = new Map<number, number>();
  for (let i = 0; i < groupCount; i++) {
    const startChar = reader.uint32();
    const endChar = reader.uint32();
    const startGlyph = reader.uint32();
    // Guard against absurd ranges in damaged fonts.
    if (endChar < startChar || endChar - startChar > 0x11_0000) break;
    for (let code = startChar; code <= endChar; code++) {
      mapping.set(code, startGlyph + (code - startChar));
    }
  }
  return mapping;
}

function readFormat13(reader: BinaryReader): Map<number, number> {
  reader.skip(2 + 4 + 4);
  const groupCount = reader.uint32();
  const mapping = new Map<number, number>();
  for (let i = 0; i < groupCount; i++) {
    const startChar = reader.uint32();
    const endChar = reader.uint32();
    const glyphId = reader.uint32();
    if (endChar < startChar || endChar - startChar > 0x11_0000) break;
    for (let code = startChar; code <= endChar; code++)
      mapping.set(code, glyphId);
  }
  return mapping;
}

interface VariationSelectorMap {
  unicode: Map<number, Map<number, number>>;
}

function readFormat14(reader: BinaryReader): {
  mapping: Map<string, number[]>;
  detail: VariationSelectorMap;
} {
  reader.skip(2 + 4 + 4); // reserved, length, numVarSelectorRecords
  const recordCount = reader.uint32();
  const mapping = new Map<string, number[]>();
  const unicode = new Map<number, Map<number, number>>();

  for (let i = 0; i < recordCount; i++) {
    const varSelector = reader.uint24();
    const defaultOffset = reader.uint32();
    const start = reader.position;

    let low = 0;
    if (defaultOffset > 0) {
      const resume = reader.position;
      reader.seek(defaultOffset);
      const defaultCount = reader.uint32();
      for (let g = 0; g < defaultCount; g++) {
        const code = reader.uint24();
        const glyphId = reader.uint16();
        const key = `${varSelector.toString(16)}:${code.toString(16)}`;
        mapping.set(key, [glyphId]);
        low = Math.max(low, code);
      }
      reader.seek(resume);
    }

    reader.skip(4); // nonDefaultStartOffset
    const nonDefaultCount = reader.uint32();
    const perSelector = new Map<number, number>();
    for (let g = 0; g < nonDefaultCount; g++) {
      const code = reader.uint24();
      const glyphId = reader.uint16();
      const key = `${varSelector.toString(16)}:${code.toString(16)}`;
      mapping.set(key, [glyphId]);
      perSelector.set(code, glyphId);
    }
    unicode.set(varSelector, perSelector);
    reader.seek(start);
  }

  return { mapping, detail: { unicode } };
}

/**
 * Ranks a subtable so the most complete Unicode mapping wins. Windows platform
 * records are the most trustworthy, then Unicode, then the legacy ISO ones.
 */
function scoreSubtable(platformId: number, format: number): number {
  if (format === 14) return 0; // variation sequences are handled separately
  let score = 0;
  if (platformId === 3) score += 40;
  else if (platformId === 0) score += 30;
  else if (platformId === 2) score += 10;

  if (format === 12 || format === 13) score += 20;
  else if (format === 4) score += 15;
  else if (format === 6) score += 8;
  else if (format === 0) score += 5;
  return score;
}

export function parseCmap(bytes: Uint8Array): CmapAnalysis {
  const reader = new BinaryReader(bytes);
  const version = reader.uint16();
  if (version !== 0) {
    throw new FontAnalysisError("corrupted", "unsupported cmap version");
  }

  const numTables = reader.uint16();
  const offsets: { platformId: number; encodingId: number; offset: number }[] =
    [];
  for (let i = 0; i < numTables; i++) {
    offsets.push({
      platformId: reader.uint16(),
      encodingId: reader.uint16(),
      offset: reader.uint32(),
    });
  }

  const subtables: CmapSubtable[] = [];
  let variations = new Map<string, number[]>();
  let best: CmapSubtable | null = null;

  for (const entry of offsets) {
    if (entry.offset >= bytes.byteLength) continue;
    let tableReader: BinaryReader;
    try {
      tableReader = new BinaryReader(bytes).seek(entry.offset);
      const format = tableReader.uint16();
      const sub = (parsed: Map<number, number>): CmapSubtable => ({
        platformId: entry.platformId,
        platform: platformName(entry.platformId),
        encodingId: entry.encodingId,
        encoding: encodingName(
          entry.encodingId === 10 ? 0 : entry.platformId,
          entry.encodingId,
        ),
        kind: encodingKind(entry.platformId),
        format,
        preference: scoreSubtable(entry.platformId, format),
        mapping: parsed,
      });

      if (format === 0) {
        const parsed = readFormat0(tableReader);
        const candidate = sub(parsed);
        subtables.push(candidate);
        if (!best || candidate.preference > best.preference) best = candidate;
      } else if (format === 4) {
        const parsed = readFormat4(tableReader);
        const candidate = sub(parsed);
        subtables.push(candidate);
        if (!best || candidate.preference > best.preference) best = candidate;
      } else if (format === 6) {
        const parsed = readFormat6(tableReader);
        const candidate = sub(parsed);
        subtables.push(candidate);
        if (!best || candidate.preference > best.preference) best = candidate;
      } else if (format === 12) {
        const parsed = readFormat12(tableReader);
        const candidate = sub(parsed);
        subtables.push(candidate);
        if (!best || candidate.preference > best.preference) best = candidate;
      } else if (format === 13) {
        const parsed = readFormat13(tableReader);
        const candidate = sub(parsed);
        subtables.push(candidate);
        if (!best || candidate.preference > best.preference) best = candidate;
      } else if (format === 14) {
        const parsed = readFormat14(tableReader);
        variations = parsed.mapping;
        subtables.push(sub(new Map()));
      }
    } catch {
      // A single damaged subtable must not invalidate the whole cmap.
    }
  }

  subtables.sort((a, b) => b.preference - a.preference);

  return {
    subtables,
    mapping: best?.mapping ?? new Map(),
    variations,
    format: best?.format ?? null,
    platformId: best?.platformId ?? null,
    encodingId: best?.encodingId ?? null,
  };
}

/**
 * Rebuilds a minimal, standards-compliant cmap (format 4 for the BMP plus
 * format 12 when needed) from an already-parsed mapping.
 *
 * This exists because real fonts routinely ship cmap subtables that some
 * consumers reject — format 6 Mac Roman subtables are the common case — and
 * feeding the original bytes onward would make an otherwise valid font fail.
 */
export function buildCmap(
  mapping: Map<number, number>,
  platformId = 3,
  encodingId = 1,
): Uint8Array {
  const bmp: [number, number][] = [];
  const astral: [number, number][] = [];
  for (const [code, glyphId] of mapping) {
    if (glyphId === 0) continue;
    if (code <= 0xffff) bmp.push([code, glyphId]);
    else astral.push([code, glyphId]);
  }
  bmp.sort((a, b) => a[0] - b[0]);
  astral.sort((a, b) => a[0] - b[0]);

  const useAstral = astral.length > 0;
  const subtables: Uint8Array[] = useAstral
    ? [buildFormat4(bmp), buildFormat12(astral)]
    : [buildFormat4(bmp)];

  const headerSize = 4 + subtables.length * 8;
  let total = headerSize;
  for (const table of subtables)
    total += table.byteLength + ((4 - (table.byteLength % 4)) % 4);

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0);
  view.setUint16(2, subtables.length);

  let offset = headerSize;
  subtables.forEach((table, index) => {
    const record = 4 + index * 8;
    view.setUint16(record, platformId);
    view.setUint16(record + 2, useAstral && index === 1 ? 10 : encodingId);
    view.setUint32(record + 4, offset);
    out.set(table, offset);
    offset += table.byteLength;
    offset += (4 - (table.byteLength % 4)) % 4;
  });

  return out;
}

function buildFormat4(entries: [number, number][]): Uint8Array {
  const segments: { start: number; end: number; startGlyph: number }[] = [];
  for (const [code, glyphId] of entries) {
    const last = segments[segments.length - 1];
    if (
      last &&
      code === last.end + 1 &&
      glyphId === last.startGlyph + (code - last.start)
    ) {
      last.end = code;
      continue;
    }
    segments.push({ start: code, end: code, startGlyph: glyphId });
  }
  // A trailing 0xFFFF segment is mandatory.
  segments.push({ start: 0xffff, end: 0xffff, startGlyph: 1 });

  const segCount = segments.length;
  const length = 16 + segCount * 8;
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  const entrySelector = Math.floor(Math.log2(segCount));
  const searchRange = 2 ** entrySelector * 2;

  view.setUint16(0, 4);
  view.setUint16(2, length);
  view.setUint16(4, 0);
  view.setUint16(6, segCount * 2);
  view.setUint16(8, searchRange);
  view.setUint16(10, entrySelector);
  view.setUint16(12, segCount * 2 - searchRange);

  const endCodes = 14;
  const reservedPad = endCodes + segCount * 2;
  const startCodes = reservedPad + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;

  segments.forEach((segment, index) => {
    view.setUint16(endCodes + index * 2, segment.end);
    view.setUint16(startCodes + index * 2, segment.start);
    view.setInt16(idDeltas + index * 2, segment.startGlyph - segment.start);
    view.setUint16(idRangeOffsets + index * 2, 0);
  });

  return out;
}

function buildFormat12(entries: [number, number][]): Uint8Array {
  interface Group {
    start: number;
    end: number;
    startGlyph: number;
  }
  const groups: Group[] = [];
  for (const [code, glyphId] of entries) {
    const last = groups[groups.length - 1];
    if (
      last &&
      code === last.end + 1 &&
      glyphId === last.startGlyph + (code - last.start)
    ) {
      last.end = code;
      continue;
    }
    groups.push({ start: code, end: code, startGlyph: glyphId });
  }

  const out = new Uint8Array(16 + groups.length * 12);
  const view = new DataView(out.buffer);
  view.setUint16(0, 12);
  view.setUint16(2, 0);
  view.setUint32(4, out.byteLength);
  view.setUint32(8, 0);
  view.setUint32(12, groups.length);
  groups.forEach((group, index) => {
    const at = 16 + index * 12;
    view.setUint32(at, group.start);
    view.setUint32(at + 4, group.end);
    view.setUint32(at + 8, group.startGlyph);
  });
  return out;
}
