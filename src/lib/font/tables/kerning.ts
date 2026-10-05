import type { BinaryRegion } from "../binary-reader";
import { BinaryReader } from "../binary-reader";
import { FontAnalysisError } from "../errors";

/**
 * Kerning from the legacy `kern` table and from GPOS pair positioning.
 *
 * Both are reported separately because they behave differently: the `kern`
 * table only adjusts advances, while GPOS can also move, scale and rotate
 * glyphs, and browsers apply it in preference to the legacy table.
 */

export type KernPair = {
  left: number;
  right: number;
  value: number;
};

export type KerningSource = "kern" | "GPOS";

export type KerningData = {
  sources: KerningSource[];
  /** Deduplicated pairs, keyed by `left * 65536 + right`. */
  pairs: Map<number, KernPair>;
  counts: Record<KerningSource, number>;
};

function pairKey(left: number, right: number): number {
  return left * 65536 + right;
}

function addPair(
  pairs: Map<number, KernPair>,
  left: number,
  right: number,
  value: number,
): void {
  if (value === 0) return;
  const key = pairKey(left, right);
  if (!pairs.has(key)) pairs.set(key, { left, right, value });
}

/**
 * Format 0 of the Apple `kern` table (version 0, subtable list) and the
 * Microsoft variant (version 1, a flat pair array).
 */
function readKernTable(
  bytes: Uint8Array,
  region: BinaryRegion,
  pairs: Map<number, KernPair>,
): number {
  const reader = new BinaryReader(bytes, region);
  const version = reader.uint16();

  if (version === 1) {
    // Microsoft: nPairs, then search params, then the pairs.
    const nPairs = reader.uint16();
    reader.skip(6);
    let count = 0;
    for (let p = 0; p < nPairs; p++) {
      const left = reader.uint16();
      const right = reader.uint16();
      const value = reader.int16();
      addPair(pairs, left, right, value);
      count++;
    }
    return count;
  }

  if (version !== 0) {
    throw new FontAnalysisError("corrupted", "unsupported kern version");
  }

  // Apple: a list of subtables, each with its own length and coverage bits.
  const subtables = reader.uint16();
  reader.skip(6);
  let count = 0;

  for (let i = 0; i < subtables; i++) {
    const subStart = reader.position;
    if (subStart + 4 > region.length) break;
    const length = reader.uint16();
    const coverage = reader.uint16();
    const format = coverage >> 8;
    const isHorizontal = (coverage & 0x1) === 1;
    const isMinimum = (coverage & 0x2) !== 0;

    if (isHorizontal && !isMinimum && format === 0) {
      const nPairs = reader.uint16();
      reader.skip(6);
      for (let p = 0; p < nPairs; p++) {
        const left = reader.uint16();
        const right = reader.uint16();
        const value = reader.int16();
        addPair(pairs, left, right, value);
        count++;
      }
    }

    if (length === 0) break;
    reader.seek(subStart + length);
  }

  return count;
}

function readCoverageGlyphs(bytes: Uint8Array, offset: number): number[] {
  const reader = new BinaryReader(bytes).seek(offset);
  const format = reader.uint16();
  const glyphs: number[] = [];

  if (format === 1) {
    const glyphCount = reader.uint16();
    for (let i = 0; i < glyphCount; i++) glyphs.push(reader.uint16());
  } else if (format === 2) {
    const rangeCount = reader.uint16();
    for (let i = 0; i < rangeCount; i++) {
      const start = reader.uint16();
      const end = reader.uint16();
      const startIndex = reader.uint16();
      for (let g = start; g <= end; g++) glyphs.push(startIndex + (g - start));
    }
  }

  return glyphs;
}

function readClassDef(bytes: Uint8Array, offset: number): Map<number, number> {
  const reader = new BinaryReader(bytes).seek(offset);
  const format = reader.uint16();
  const out = new Map<number, number>();

  if (format === 1) {
    const startGlyph = reader.uint16();
    const count = reader.uint16();
    for (let i = 0; i < count; i++) {
      const classValue = reader.uint16();
      if (classValue !== 0) out.set(startGlyph + i, classValue);
    }
  } else if (format === 2) {
    const count = reader.uint16();
    for (let i = 0; i < count; i++) {
      const startGlyph = reader.uint16();
      const endGlyph = reader.uint16();
      const classValue = reader.uint16();
      if (classValue === 0) continue;
      for (let glyph = startGlyph; glyph <= endGlyph; glyph++) {
        out.set(glyph, classValue);
      }
    }
  }

  return out;
}

function readValueRecord(
  reader: BinaryReader,
  valueFormat: number,
): { xAdvance: number; hasPlacement: boolean } {
  let xAdvance = 0;
  let hasPlacement = false;

  const readXPlacement = () => {
    hasPlacement = true;
    reader.int16();
  };
  const readPlacement = () => {
    hasPlacement = true;
    reader.int16();
    reader.int16();
  };

  if (valueFormat & 0x0001) readXPlacement();
  if (valueFormat & 0x0002) reader.int16();
  if (valueFormat & 0x0004) {
    hasPlacement = true;
    reader.int16();
  }
  if (valueFormat & 0x0008) readPlacement();
  if (valueFormat & 0x0010) {
    xAdvance = reader.int16();
  }
  if (valueFormat & 0x0020) {
    xAdvance += reader.int16();
  }
  if (valueFormat & 0x0040) {
    xAdvance += reader.int16();
  }
  if (valueFormat & 0x0080) {
    xAdvance = reader.int16();
  }

  return { xAdvance, hasPlacement };
}

const VALUE_RECORD_SIZE = 2;

/** GPOS lookup type 2 (pair adjustment) — the modern kerning mechanism. */
function readPairPos(
  bytes: Uint8Array,
  offset: number,
  pairs: Map<number, KernPair>,
): number {
  const reader = new BinaryReader(bytes).seek(offset);
  const posFormat = reader.uint16();
  const coverageOffset = reader.uint16();
  const valueFormat1 = reader.uint16();
  const valueFormat2 = reader.uint16();
  const coverage = readCoverageGlyphs(bytes, offset + coverageOffset);
  let count = 0;

  if (posFormat === 1) {
    const pairSetCount = reader.uint16();
    const pairSetOffsets: number[] = [];
    for (let i = 0; i < pairSetCount; i++) pairSetOffsets.push(reader.uint16());

    for (let i = 0; i < pairSetCount; i++) {
      const left = coverage[i];
      if (left === undefined) continue;
      const set = new BinaryReader(bytes).seek(offset + pairSetOffsets[i]);
      const pairValueCount = set.uint16();
      for (let p = 0; p < pairValueCount; p++) {
        const right = set.uint16();
        const { xAdvance } = readValueRecord(set, valueFormat1);
        addPair(pairs, left, right, xAdvance);
        count++;
      }
    }
    return count;
  }

  if (posFormat === 2) {
    const classDef1Offset = reader.uint16();
    const classDef2Offset = reader.uint16();
    const class1Count = reader.uint16();
    const class2Count = reader.uint16();
    const class1 = readClassDef(bytes, offset + classDef1Offset);
    const class2 = readClassDef(bytes, offset + classDef2Offset);

    const recordSize =
      VALUE_RECORD_SIZE * (bitCount(valueFormat1) + bitCount(valueFormat2));
    const recordsStart = reader.position;

    // Build a glyph -> class index lookup so class pairs can be expanded.
    const class1Glyphs = new Map<number, number>();
    for (const [glyph, value] of class1) class1Glyphs.set(glyph, value);
    const class2Glyphs = new Map<number, number>();
    for (const [glyph, value] of class2) class2Glyphs.set(glyph, value);

    for (let c1 = 0; c1 < class1Count; c1++) {
      for (let c2 = 0; c2 < class2Count; c2++) {
        const record = new BinaryReader(bytes).seek(
          recordsStart + (c1 * class2Count + c2) * recordSize,
        );
        const { xAdvance } = readValueRecord(record, valueFormat1);
        if (xAdvance === 0) continue;

        for (const [glyph, value] of class1Glyphs) {
          if (value !== c1) continue;
          for (const [other, otherValue] of class2Glyphs) {
            if (otherValue !== c2) continue;
            addPair(pairs, glyph, other, xAdvance);
            count++;
          }
        }
      }
    }
  }

  return count;
}

function bitCount(valueFormat: number): number {
  let count = 0;
  for (let i = 0; i < 16; i++) {
    if (valueFormat & (1 << i)) count++;
  }
  return count;
}

export type GposEntry = {
  gpos: Uint8Array;
  lookupListOffset: number;
};

export function readKerning(
  kernTable: Uint8Array | null,
  gpos: GposEntry | null,
): KerningData {
  const pairs = new Map<number, KernPair>();
  const sources: KerningSource[] = [];
  const counts: Record<KerningSource, number> = { kern: 0, GPOS: 0 };

  if (kernTable && kernTable.byteLength > 0) {
    try {
      const read = readKernTable(
        kernTable,
        { offset: 0, length: kernTable.byteLength },
        pairs,
      );
      counts.kern = read;
      if (read > 0) sources.push("kern");
    } catch {
      // A damaged kern table must not invalidate the font.
    }
  }

  if (gpos && gpos.gpos.byteLength > 0) {
    try {
      const bytes = gpos.gpos;
      const reader = new BinaryReader(bytes);
      reader.uint16();
      reader.uint16();
      reader.uint16();
      reader.uint16();
      const lookupListOffset = reader.uint16();

      const lookupReader = new BinaryReader(bytes).seek(lookupListOffset);
      const lookupCount = lookupReader.uint16();
      const offsets: number[] = [];
      for (let i = 0; i < lookupCount; i++) offsets.push(lookupReader.uint16());

      let read = 0;
      for (const lookupOffset of offsets) {
        const at = lookupListOffset + lookupOffset;
        const lookup = new BinaryReader(bytes).seek(at);
        const lookupType = lookup.uint16();
        lookup.uint16(); // lookupFlag
        const subtableCount = lookup.uint16();
        const subtableOffsets: number[] = [];
        for (let i = 0; i < subtableCount; i++)
          subtableOffsets.push(lookup.uint16());

        for (const subtable of subtableOffsets) {
          const absolute = at + subtable;
          if (absolute >= bytes.byteLength) continue;
          if (lookupType === 9) {
            read += readPairPos(bytes, absolute, pairs);
          } else if (lookupType === 2) {
            // Extension wrapping a pair positioning lookup.
            const ext = new BinaryReader(bytes).seek(absolute);
            ext.uint16(); // format
            const extensionType = ext.uint16();
            const extensionOffset = ext.uint32();
            if (extensionType === 9) {
              read += readPairPos(bytes, absolute + extensionOffset, pairs);
            }
          }
        }
      }
      counts.GPOS = read;
      if (read > 0) sources.push("GPOS");
    } catch {
      // A damaged GPOS table must not invalidate the font.
    }
  }

  return { sources, pairs, counts };
}
