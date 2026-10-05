import { BinaryReader } from "./binary-reader";
import { type BrotliDecompressor, loadBrotliDecompressor } from "./brotli";
import { buildSfnt, type TablePayload } from "./container";
import { FontAnalysisError } from "./errors";

/** WOFF2 known-tag table, indexed by the low 6 bits of the flags byte. */
const KNOWN_TAGS = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill",
];

const TAG_GLYF = 0x676c_7966;
const TAG_LOCA = 0x6c6f_6361;

const GLYF_ON_CURVE = 1 << 0;
const GLYF_X_SHORT = 1 << 1;
const GLYF_Y_SHORT = 1 << 2;
const GLYF_REPEAT = 1 << 3;
const GLYF_THIS_X_IS_SAME = 1 << 4;
const GLYF_THIS_Y_IS_SAME = 1 << 5;
const OVERLAP_SIMPLE = 1 << 6;
const OVERLAP_SIMPLE_BITMAP = 1 << 0;

const COMPONENT_ARG_1_AND_2_ARE_WORDS = 1 << 0;
const COMPONENT_WE_HAVE_A_SCALE = 1 << 3;
const COMPONENT_MORE_COMPONENTS = 1 << 5;
const COMPONENT_WE_HAVE_AN_X_AND_Y_SCALE = 1 << 6;
const COMPONENT_WE_HAVE_A_TWO_BY_TWO = 1 << 7;
const COMPONENT_WE_HAVE_INSTRUCTIONS = 1 << 8;

const NUM_GLYF_SUBSTREAMS = 7;

interface Woff2TableEntry {
  tag: string;
  /** Offset of this table inside the Brotli-decompressed stream. */
  srcOffset: number;
  /** Bytes consumed inside the decompressed stream. */
  srcLength: number;
  /** Length of the table once reconstructed. */
  dstLength: number;
  transformed: boolean;
}

interface Woff2Header {
  flavor: number;
  tables: Woff2TableEntry[];
  compressedLength: number;
  compressedOffset: number;
  uncompressedSize: number;
  /** Table indices that belong to the first font of a collection. */
  fontTableIndices: number[] | null;
}

/** WOFF2 UIntBase128: 7 bits per byte, MSB set while more bytes follow. */
function readUIntBase128(reader: BinaryReader): number {
  let result = 0;
  for (let i = 0; i < 5; i++) {
    const byte = reader.uint8();
    if (i === 0 && byte === 0x80) {
      throw new FontAnalysisError(
        "corrupted",
        "WOFF2 UIntBase128 leading zero",
      );
    }
    if (result & 0xfe00_0000) {
      throw new FontAnalysisError("corrupted", "WOFF2 UIntBase128 overflow");
    }
    result = (result << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return result >>> 0;
  }
  throw new FontAnalysisError("corrupted", "WOFF2 UIntBase128 too long");
}

/**
 * WOFF2 `255UInt16`: a single byte below 253, otherwise an escape code.
 * `253` introduces a full UInt16, `254` adds 506 and `255` adds 253.
 */
function read255UShort(reader: BinaryReader): number {
  const code = reader.uint8();
  if (code === 253) return reader.uint16();
  if (code === 255) return reader.uint8() + 253;
  if (code === 254) return reader.uint8() + 506;
  return code;
}

function tagToNumber(tag: string): number {
  return (
    ((tag.charCodeAt(0) << 24) |
      (tag.charCodeAt(1) << 16) |
      (tag.charCodeAt(2) << 8) |
      tag.charCodeAt(3)) >>>
    0
  );
}

function readWoff2Header(bytes: Uint8Array): Woff2Header {
  const reader = new BinaryReader(bytes);
  const signature = reader.uint32();
  if (signature !== 0x774f_4632) {
    throw new FontAnalysisError("unsupported-format");
  }

  const flavor = reader.uint32();
  const declaredLength = reader.uint32();
  if (declaredLength !== bytes.byteLength) {
    throw new FontAnalysisError("corrupted", "WOFF2 length mismatch");
  }

  const numTables = reader.uint16();
  if (numTables === 0) {
    throw new FontAnalysisError("corrupted", "WOFF2 has no tables");
  }

  reader.skip(2 + 4); // reserved, totalSfntSize
  const compressedLength = reader.uint32(); // totalCompressedSize
  reader.skip(2 + 2); // majorVersion, minorVersion
  reader.uint32(); // metaOffset
  reader.uint32(); // metaLength
  reader.uint32(); // metaOrigLength
  reader.uint32(); // privOffset
  reader.uint32(); // privLength

  let srcOffset = 0;
  const tables: Woff2TableEntry[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = reader.uint8();
    const low = flags & 0x3f;
    const tag = low === 0x3f ? reader.tag() : (KNOWN_TAGS[low] ?? "");

    if (tag.length !== 4) {
      throw new FontAnalysisError("corrupted", "WOFF2 unknown table tag");
    }

    const transformVersion = (flags >> 6) & 0x03;
    const isGlyfOrLoca =
      tagToNumber(tag) === TAG_GLYF || tagToNumber(tag) === TAG_LOCA;
    const transformed = isGlyfOrLoca
      ? transformVersion === 0
      : transformVersion !== 0;

    const dstLength = readUIntBase128(reader);
    let srcLength = dstLength;
    if (transformed) {
      srcLength = readUIntBase128(reader);
      if (isGlyfOrLoca && tagToNumber(tag) === TAG_LOCA && srcLength !== 0) {
        throw new FontAnalysisError(
          "corrupted",
          "transformed loca must be empty",
        );
      }
    }

    tables.push({ tag, srcOffset, srcLength, dstLength, transformed });
    srcOffset += srcLength;
  }

  const uncompressedSize = srcOffset;
  if (uncompressedSize < 1) {
    throw new FontAnalysisError("corrupted", "WOFF2 has no table data");
  }

  let fontTableIndices: number[] | null = null;
  if (flavor === 0x7474_6366) {
    fontTableIndices = readCollectionDirectory(reader, numTables);
  }

  return {
    flavor,
    tables,
    compressedLength,
    compressedOffset: reader.position,
    uncompressedSize,
    fontTableIndices,
  };
}

function readCollectionDirectory(
  reader: BinaryReader,
  numTables: number,
): number[] {
  const version = reader.uint32();
  if (version !== 0x0001_0000 && version !== 0x0002_0000) {
    throw new FontAnalysisError("corrupted", "unsupported WOFF2 collection");
  }
  const fontCount = read255UShort(reader);
  if (fontCount < 1) {
    throw new FontAnalysisError("collection-empty");
  }

  let firstFontTables: number[] = [];
  for (let font = 0; font < fontCount; font++) {
    const tableCount = read255UShort(reader);
    reader.uint32(); // per-font flavour
    const indices: number[] = [];
    for (let i = 0; i < tableCount; i++) {
      const index = read255UShort(reader);
      if (index >= numTables) {
        throw new FontAnalysisError(
          "corrupted",
          "WOFF2 collection table index",
        );
      }
      indices.push(index);
    }
    if (font === 0) firstFontTables = indices;
  }
  return firstFontTables;
}

/** Growable byte sink used to reassemble transformed tables. */
class ByteSink {
  private buffer: Uint8Array;
  length = 0;

  constructor(initial = 1 << 16) {
    this.buffer = new Uint8Array(initial);
  }

  reserve(extra: number): void {
    if (this.length + extra <= this.buffer.byteLength) return;
    let size = this.buffer.byteLength * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }

  write(bytes: Uint8Array): void {
    this.reserve(bytes.byteLength);
    this.buffer.set(bytes, this.length);
    this.length += bytes.byteLength;
  }

  pad4(): void {
    const padding = (4 - (this.length % 4)) % 4;
    if (padding > 0) this.write(new Uint8Array(padding));
  }

  take(length: number): Uint8Array {
    return this.buffer.slice(0, length);
  }
}

interface Point {
  x: number;
  y: number;
  onCurve: boolean;
}

interface SubstreamCursor {
  bytes: Uint8Array;
  position: number;
}

/** Decodes the WOFF2 coordinate triplet stream into absolute points. */
function tripletDecode(
  flags: Uint8Array,
  data: Uint8Array,
  dataOffset: number,
  pointCount: number,
): { points: Point[]; consumed: number } {
  const points: Point[] = new Array(pointCount);
  let tripletIndex = 0;
  let x = 0;
  let y = 0;

  const sign = (flag: number, base: number) => (flag & 1 ? base : -base);

  for (let i = 0; i < pointCount; i++) {
    if (i >= flags.byteLength) {
      throw new FontAnalysisError("corrupted", "WOFF2 flag stream exhausted");
    }
    const rawFlag = flags[i];
    const onCurve = (rawFlag & 0x80) === 0;
    const flag = rawFlag & 0x7f;

    let dataBytes: number;
    if (flag < 84) dataBytes = 1;
    else if (flag < 120) dataBytes = 2;
    else if (flag < 124) dataBytes = 3;
    else dataBytes = 4;

    if (tripletIndex + dataBytes > data.byteLength - dataOffset) {
      throw new FontAnalysisError(
        "corrupted",
        "WOFF2 triplet stream exhausted",
      );
    }

    const at = (k: number) => data[dataOffset + tripletIndex + k];

    let dx: number;
    let dy: number;
    if (flag < 10) {
      dx = 0;
      dy = sign(flag, ((flag & 14) << 7) + at(0));
    } else if (flag < 20) {
      dx = sign(flag, (((flag - 10) & 14) << 7) + at(0));
      dy = 0;
    } else if (flag < 84) {
      const b0 = flag - 20;
      const b1 = at(0);
      dx = sign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
      dy = sign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
    } else if (flag < 120) {
      const b0 = flag - 84;
      dx = sign(flag, 1 + ((b0 / 12) << 8) + at(0));
      dy = sign(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + at(1));
    } else if (flag < 124) {
      const b2 = at(1);
      dx = sign(flag, (at(0) << 4) + (b2 >> 4));
      dy = sign(flag >> 1, ((b2 & 0x0f) << 8) + at(2));
    } else {
      dx = sign(flag, (at(0) << 8) + at(1));
      dy = sign(flag >> 1, (at(2) << 8) + at(3));
    }

    tripletIndex += dataBytes;
    x += dx;
    y += dy;
    points[i] = { x, y, onCurve };
  }

  return { points, consumed: tripletIndex };
}

/** Re-encodes absolute points into standard `glyf` flags and deltas. */
function storePoints(
  points: Point[],
  contourCount: number,
  instructionLength: number,
  hasOverlapBit: boolean,
): Uint8Array {
  const flagOffset = 10 + 2 * contourCount + 2 + instructionLength;
  const flags: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];

  let lastFlag = -1;
  let repeatCount = 0;
  let lastX = 0;
  let lastY = 0;
  let xBytes = 0;
  let yBytes = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let flag = point.onCurve ? GLYF_ON_CURVE : 0;
    if (hasOverlapBit && i === 0) flag |= OVERLAP_SIMPLE;

    const dx = point.x - lastX;
    const dy = point.y - lastY;

    if (dx === 0) {
      flag |= GLYF_THIS_X_IS_SAME;
      xs.push(0);
    } else if (dx > -256 && dx < 256) {
      flag |= GLYF_X_SHORT | (dx > 0 ? GLYF_THIS_X_IS_SAME : 0);
      xs.push(Math.abs(dx));
      xBytes += 1;
    } else {
      xs.push(dx);
      xBytes += 2;
    }

    if (dy === 0) {
      flag |= GLYF_THIS_Y_IS_SAME;
      ys.push(0);
    } else if (dy > -256 && dy < 256) {
      flag |= GLYF_Y_SHORT | (dy > 0 ? GLYF_THIS_Y_IS_SAME : 0);
      ys.push(Math.abs(dy));
      yBytes += 1;
    } else {
      ys.push(dy);
      yBytes += 2;
    }

    if (flag === lastFlag && repeatCount !== 255) {
      flags[flags.length - 1] |= GLYF_REPEAT;
      repeatCount++;
    } else {
      if (repeatCount !== 0) flags.push(repeatCount);
      flags.push(flag);
      repeatCount = 0;
    }

    lastX = point.x;
    lastY = point.y;
    lastFlag = flag;
  }
  if (repeatCount !== 0) flags.push(repeatCount);

  const out = new Uint8Array(flagOffset + flags.length + xBytes + yBytes);
  const view = new DataView(out.buffer);
  let offset = flagOffset;
  for (const flag of flags) out[offset++] = flag;

  let xOffset = offset;
  for (const dx of xs) {
    if (dx === 0) continue;
    if (dx > -256 && dx < 256) out[xOffset++] = dx & 0xff;
    else {
      view.setInt16(xOffset, dx);
      xOffset += 2;
    }
  }
  for (const dy of ys) {
    if (dy === 0) continue;
    if (dy > -256 && dy < 256) out[xOffset++] = dy & 0xff;
    else {
      view.setInt16(xOffset, dy);
      xOffset += 2;
    }
  }

  // `out` is indexed as if written into a full glyf record, so the leading
  // head bytes are skipped here: the caller already emitted them.
  return out.slice(flagOffset, xOffset);
}

function computeBbox(points: Point[]): number[] {
  let xMin = 0;
  let yMin = 0;
  let xMax = 0;
  let yMax = 0;
  if (points.length > 0) {
    xMin = xMax = points[0].x;
    yMin = yMax = points[0].y;
  }
  for (let i = 1; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  return [xMin, yMin, xMax, yMax];
}

interface CompositeBlock {
  data: Uint8Array;
  hasInstructions: boolean;
}

function readCompositeBlock(stream: SubstreamCursor): CompositeBlock {
  const start = stream.position;
  let hasInstructions = false;
  let flags = COMPONENT_MORE_COMPONENTS;

  while (flags & COMPONENT_MORE_COMPONENTS) {
    if (stream.position + 2 > stream.bytes.byteLength) {
      throw new FontAnalysisError("corrupted", "WOFF2 composite stream");
    }
    flags = readUint16At(stream.bytes, stream.position);
    stream.position += 2;
    hasInstructions ||= (flags & COMPONENT_WE_HAVE_INSTRUCTIONS) !== 0;

    let argSize = 2;
    argSize += flags & COMPONENT_ARG_1_AND_2_ARE_WORDS ? 4 : 2;
    if (flags & COMPONENT_WE_HAVE_A_SCALE) argSize += 2;
    else if (flags & COMPONENT_WE_HAVE_AN_X_AND_Y_SCALE) argSize += 4;
    else if (flags & COMPONENT_WE_HAVE_A_TWO_BY_TWO) argSize += 8;

    stream.position += argSize;
  }

  return {
    data: stream.bytes.subarray(start, stream.position),
    hasInstructions,
  };
}

function readUint16At(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

interface GlyfReconstruction {
  data: Uint8Array;
  locaValues: Uint32Array;
  xMins: Int16Array<ArrayBuffer>;
  numGlyphs: number;
  indexFormat: number;
}

/** Rebuilds a standard `glyf` + `loca` pair from the WOFF2 transform. */
function reconstructGlyf(
  transformed: Uint8Array,
  expectedLocaLength: number,
): GlyfReconstruction {
  if (transformed.byteLength < (2 + NUM_GLYF_SUBSTREAMS) * 4) {
    throw new FontAnalysisError("corrupted", "WOFF2 glyf header truncated");
  }

  const header = new BinaryReader(transformed);
  header.uint16(); // version
  const flags = header.uint16();
  const numGlyphs = header.uint16();
  const indexFormat = header.uint16();
  const hasOverlapBitmap = (flags & OVERLAP_SIMPLE_BITMAP) !== 0;

  const expected = (indexFormat ? 4 : 2) * (numGlyphs + 1);
  if (expectedLocaLength !== expected) {
    throw new FontAnalysisError("corrupted", "WOFF2 loca length mismatch");
  }

  const sizes: number[] = [];
  let offset = (2 + NUM_GLYF_SUBSTREAMS) * 4;
  for (let i = 0; i < NUM_GLYF_SUBSTREAMS; i++) {
    const size = header.uint32();
    if (offset + size > transformed.byteLength) {
      throw new FontAnalysisError("corrupted", "WOFF2 glyf substream overflow");
    }
    sizes.push(size);
    offset += size;
  }

  const streams: SubstreamCursor[] = [];
  let cursor = (2 + NUM_GLYF_SUBSTREAMS) * 4;
  for (const size of sizes) {
    streams.push({ bytes: transformed, position: cursor });
    cursor += size;
  }

  const [nContourStream, nPointsStream, flagStream, glyphStream] = streams;
  const compositeStream = streams[4];
  const bboxStream = streams[5];
  const instructionStream = streams[6];

  const overlapBitmap: Uint8Array = hasOverlapBitmap
    ? transformed.subarray(cursor, cursor + ((numGlyphs + 7) >> 3))
    : new Uint8Array(0);

  const xMins: Int16Array<ArrayBuffer> = new Int16Array(numGlyphs);
  const locaValues = new Uint32Array(numGlyphs + 1);
  const sink = new ByteSink();
  const bboxBytes = bboxStream.bytes;
  const bboxCursor = bboxStream.position;
  const bitmapLength = ((numGlyphs + 31) >> 5) << 2;
  let bboxRead = bboxCursor + bitmapLength;

  for (let glyphIndex = 0; glyphIndex < numGlyphs; glyphIndex++) {
    // loca records where each glyph starts, so capture it before writing.
    locaValues[glyphIndex] = sink.length;

    const haveBBox =
      (bboxBytes[bboxCursor + (glyphIndex >> 3)] &
        (0x80 >> (glyphIndex & 7))) !==
      0;

    nContourStream.position += 2;
    const nContours = readUint16At(
      nContourStream.bytes,
      nContourStream.position - 2,
    );

    if (nContours === 0xffff) {
      if (!haveBBox) {
        throw new FontAnalysisError(
          "corrupted",
          "composite glyph needs a bbox",
        );
      }
      const composite = readCompositeBlock(compositeStream);
      let instructionLength = 0;
      if (composite.hasInstructions) {
        instructionLength = read255UShortAt(glyphStream);
      }

      const glyphSize =
        2 +
        8 +
        composite.data.byteLength +
        (composite.hasInstructions ? 2 + instructionLength : 0);
      const out = new Uint8Array(glyphSize);
      const view = new DataView(out.buffer);
      view.setUint16(0, nContours);
      out.set(readBytesAt(bboxStream.bytes, bboxRead, 8), 2);
      bboxRead += 8;
      let offset = 10;
      out.set(composite.data, offset);
      offset += composite.data.byteLength;
      if (composite.hasInstructions) {
        view.setUint16(offset, instructionLength);
        offset += 2;
        out.set(
          readBytesAt(
            instructionStream.bytes,
            instructionStream.position,
            instructionLength,
          ),
          offset,
        );
        instructionStream.position += instructionLength;
      }
      sink.write(out);
    } else if (nContours > 0) {
      const pointsPerContour: number[] = [];
      let totalPoints = 0;
      for (let i = 0; i < nContours; i++) {
        const count = read255UShortAt(nPointsStream);
        pointsPerContour.push(count);
        totalPoints += count;
      }

      // The flag stream holds exactly one byte per point.
      if (totalPoints > flagStream.bytes.byteLength - flagStream.position) {
        throw new FontAnalysisError("corrupted", "WOFF2 point data exhausted");
      }

      const { points, consumed } = tripletDecode(
        flagStream.bytes.subarray(
          flagStream.position,
          flagStream.position + totalPoints,
        ),
        glyphStream.bytes,
        glyphStream.position,
        totalPoints,
      );
      flagStream.position += totalPoints;
      glyphStream.position += consumed;

      const instructionLength = read255UShortAt(glyphStream);

      const bbox: number[] = haveBBox
        ? Array.from({ length: 4 }, (_, k) => {
            const value = readInt16At(bboxStream.bytes, bboxRead + k * 2);
            bboxRead += 2;
            return value;
          })
        : computeBbox(points);

      xMins[glyphIndex] = bbox[0];

      const head = new Uint8Array(10 + 2 * nContours + 2 + instructionLength);
      const headView = new DataView(head.buffer);
      headView.setUint16(0, nContours);
      headView.setInt16(2, bbox[0]);
      headView.setInt16(4, bbox[1]);
      headView.setInt16(6, bbox[2]);
      headView.setInt16(8, bbox[3]);

      let endPoint = -1;
      let offset = 10;
      for (const count of pointsPerContour) {
        endPoint += count;
        headView.setUint16(offset, endPoint & 0xffff);
        offset += 2;
      }
      headView.setUint16(offset, instructionLength);
      offset += 2;
      head.set(
        readBytesAt(
          instructionStream.bytes,
          instructionStream.position,
          instructionLength,
        ),
        offset,
      );
      instructionStream.position += instructionLength;

      sink.write(head);
      sink.write(
        storePoints(
          points,
          nContours,
          instructionLength,
          hasOverlapBitmap &&
            (overlapBitmap[glyphIndex >> 3] & (0x80 >> (glyphIndex & 7))) !== 0,
        ),
      );
    } else if (haveBBox) {
      throw new FontAnalysisError("corrupted", "empty glyph has a bbox");
    }

    sink.pad4();
  }

  locaValues[numGlyphs] = sink.length;

  return {
    data: sink.take(sink.length),
    locaValues,
    xMins,
    numGlyphs,
    indexFormat,
  };
}

function buildLoca(glyf: GlyfReconstruction, indexFormat: number): Uint8Array {
  const count = glyf.numGlyphs + 1;
  const out = new Uint8Array(count * (indexFormat ? 4 : 2));
  const view = new DataView(out.buffer);
  let offset = 0;
  for (let i = 0; i < count; i++) {
    if (indexFormat) {
      view.setUint32(offset, glyf.locaValues[i]);
      offset += 4;
    } else {
      view.setUint16(offset, glyf.locaValues[i] >> 1);
      offset += 2;
    }
  }
  return out;
}

function readBytesAt(
  bytes: Uint8Array,
  offset: number,
  length: number,
): Uint8Array {
  return bytes.subarray(offset, offset + length);
}

function readUint16AtCursor(cursor: SubstreamCursor): number {
  const value = readUint16At(cursor.bytes, cursor.position);
  cursor.position += 2;
  return value;
}

function read255UShortAt(cursor: SubstreamCursor): number {
  const code = cursor.bytes[cursor.position++];
  if (code === 253) return readUint16AtCursor(cursor);
  if (code === 255) return cursor.bytes[cursor.position++] + 253;
  if (code === 254) return cursor.bytes[cursor.position++] + 506;
  return code;
}

function readInt16At(bytes: Uint8Array, offset: number): number {
  const value = (bytes[offset] << 8) | bytes[offset + 1];
  return value & 0x8000 ? value - 0x10000 : value;
}

/** Rebuilds `hmtx` from the WOFF2 advance-width optimisation. */
function reconstructHmtx(
  transformed: Uint8Array,
  numGlyphs: number,
  numHMetrics: number,
  xMins: Int16Array<ArrayBuffer>,
): Uint8Array {
  const reader = new BinaryReader(transformed);
  const hmtxFlags = reader.uint8();
  if ((hmtxFlags & 0xfc) !== 0) {
    throw new FontAnalysisError("corrupted", "invalid WOFF2 hmtx flags");
  }

  const hasProportionalLsbs = (hmtxFlags & 1) === 0;
  const hasMonospaceLsbs = (hmtxFlags & 2) === 0;
  if (hasProportionalLsbs && hasMonospaceLsbs) {
    throw new FontAnalysisError("corrupted", "invalid WOFF2 hmtx flags");
  }
  if (numHMetrics > numGlyphs || numHMetrics < 1) {
    throw new FontAnalysisError("corrupted", "invalid WOFF2 numHMetrics");
  }

  const advanceWidths: number[] = [];
  for (let i = 0; i < numHMetrics; i++) advanceWidths.push(reader.uint16());

  const lsbs = new Array<number>(numGlyphs);
  for (let i = 0; i < numHMetrics; i++) {
    lsbs[i] = hasProportionalLsbs ? reader.int16() : xMins[i];
  }
  for (let i = numHMetrics; i < numGlyphs; i++) {
    lsbs[i] = hasMonospaceLsbs ? reader.int16() : xMins[i];
  }

  const out = new Uint8Array(2 * numGlyphs + 2 * numHMetrics);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numHMetrics) {
      view.setUint16(offset, advanceWidths[i]);
      offset += 2;
    }
    view.setUint16(offset, lsbs[i] & 0xffff);
    offset += 2;
  }
  return out;
}

function readNumHMetrics(bytes: Uint8Array): number {
  if (bytes.byteLength < 36) {
    throw new FontAnalysisError("corrupted", "WOFF2 hhea truncated");
  }
  return readUint16At(bytes, 34);
}

/**
 * Converts a WOFF2 container into a plain sfnt buffer by Brotli-decompressing
 * the table stream and reversing the `glyf`/`loca`/`hmtx` transforms.
 *
 * `decompressor` is injectable so tests can supply a synchronously initialised
 * Brotli decoder instead of fetching the WASM asset.
 */
export async function decodeWoff2(
  bytes: Uint8Array,
  decompressor?: BrotliDecompressor,
): Promise<ArrayBuffer> {
  const header = readWoff2Header(bytes);
  const decompress = decompressor ?? (await loadBrotliDecompressor());

  const compressedStart = header.compressedOffset;
  const compressedEnd = compressedStart + header.compressedLength;
  if (compressedEnd > bytes.byteLength) {
    throw new FontAnalysisError("corrupted", "WOFF2 compressed block overflow");
  }

  let stream: Uint8Array;
  try {
    stream = decompress(bytes.subarray(compressedStart, compressedEnd));
  } catch {
    throw new FontAnalysisError("corrupted", "WOFF2 Brotli stream is invalid");
  }
  if (stream.byteLength < header.uncompressedSize) {
    throw new FontAnalysisError(
      "corrupted",
      "WOFF2 Brotli stream is truncated",
    );
  }

  const selected =
    header.fontTableIndices ?? header.tables.map((_, index) => index);

  // Table order must be ascending by tag so that glyf precedes hmtx precedes loca.
  const ordered = [...selected]
    .map((index) => ({ index, entry: header.tables[index] }))
    .sort((a, b) =>
      a.entry.tag < b.entry.tag ? -1 : a.entry.tag > b.entry.tag ? 1 : 0,
    );

  const payloads: TablePayload[] = [];
  let numGlyphs = 0;
  let numHMetrics = 0;
  let xMins: Int16Array<ArrayBuffer> = new Int16Array(0);

  for (const { entry } of ordered) {
    const source = stream.subarray(
      entry.srcOffset,
      entry.srcOffset + entry.srcLength,
    );

    if (!entry.transformed) {
      const data = source.slice();
      payloads.push({ tag: entry.tag, data });
      if (entry.tag === "hhea") numHMetrics = readNumHMetrics(data);
      continue;
    }

    if (entry.tag === "glyf") {
      const locaEntry = header.tables.find((table) => table.tag === "loca");
      const glyf = reconstructGlyf(source, locaEntry?.dstLength ?? 0);
      numGlyphs = glyf.numGlyphs;
      xMins = glyf.xMins;
      payloads.push({ tag: "glyf", data: glyf.data });
      payloads.push({ tag: "loca", data: buildLoca(glyf, glyf.indexFormat) });
      continue;
    }

    if (entry.tag === "loca") continue; // emitted alongside glyf

    if (entry.tag === "hmtx") {
      payloads.push({
        tag: "hmtx",
        data: reconstructHmtx(source, numGlyphs, numHMetrics, xMins),
      });
      continue;
    }

    throw new FontAnalysisError(
      "unsupported-format",
      `WOFF2 transform ${entry.tag}`,
    );
  }

  return buildSfnt(header.flavor, payloads);
}
