import { BinaryReader } from "../binary-reader";

const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME_OR_POSITIVE = 0x10;
const Y_SAME_OR_POSITIVE = 0x20;
const OVERLAP_SIMPLE = 0x40;

const ARG_1_AND_2_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;
const WE_HAVE_INSTRUCTIONS = 0x0100;
const USE_MY_METRICS = 0x0200;
const SCALED_COMPONENT_OFFSET = 0x0800;
const UNSCALED_COMPONENT_OFFSET = 0x1000;

export type GlyphPoint = {
  x: number;
  y: number;
  onCurve: boolean;
  /** Index of the last point of the contour this point belongs to. */
  lastPointOfContour: boolean;
};

export type GlyphContour = {
  points: GlyphPoint[];
  startIndex: number;
  endIndex: number;
};

export type GlyphComponent = {
  glyphId: number;
  x: number;
  y: number;
  transform: [number, number, number, number];
  /** True when component offsets are in font units rather than 2.14 scaled. */
  unscaledOffset: boolean;
  useMyMetrics: boolean;
};

export type RawGlyph = {
  glyphId: number;
  numberOfContours: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  instructionLength: number;
  points: GlyphPoint[];
  contours: GlyphContour[];
  components: GlyphComponent[];
  isComposite: boolean;
  isEmpty: boolean;
  hasOverlap: boolean;
};

export function emptyRawGlyph(glyphId: number): RawGlyph {
  return {
    glyphId,
    numberOfContours: 0,
    xMin: 0,
    yMin: 0,
    xMax: 0,
    yMax: 0,
    instructionLength: 0,
    points: [],
    contours: [],
    components: [],
    isComposite: false,
    isEmpty: true,
    hasOverlap: false,
  };
}

/** Parses the `loca` offsets array. */
export function parseLoca(
  bytes: Uint8Array,
  indexToLocFormat: number,
  numGlyphs: number,
): Uint32Array {
  const out = new Uint32Array(numGlyphs + 1);
  if (indexToLocFormat === 0) {
    for (let i = 0; i <= numGlyphs; i++) {
      out[i] = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    }
  } else {
    for (let i = 0; i <= numGlyphs; i++) {
      const at = i * 4;
      out[i] =
        (bytes[at] << 24) |
        (bytes[at + 1] << 16) |
        (bytes[at + 2] << 8) |
        bytes[at + 3];
    }
  }
  return out.map((value) => (indexToLocFormat === 0 ? value * 2 : value >>> 0));
}

/** Parses a single glyph record out of the `glyf` table. */
export function parseRawGlyph(
  glyf: Uint8Array,
  start: number,
  end: number,
  glyphId: number,
): RawGlyph {
  const empty = emptyRawGlyph(glyphId);
  const length = end - start;
  if (length <= 0) return empty;

  const reader = new BinaryReader(glyf).seek(start);
  const numberOfContours = reader.int16();
  const xMin = reader.int16();
  const yMin = reader.int16();
  const xMax = reader.int16();
  const yMax = reader.int16();

  const glyph: RawGlyph = {
    ...empty,
    numberOfContours,
    xMin,
    yMin,
    xMax,
    yMax,
  };

  if (numberOfContours >= 0) {
    parseSimpleGlyph(reader, glyph, numberOfContours, end);
  } else {
    parseCompositeGlyph(reader, glyph, end);
    glyph.isComposite = true;
  }

  // A glyph is empty only when it has neither contours nor components: a
  // composite is made of other glyphs even though it declares no contours.
  glyph.isEmpty = glyph.contours.length === 0 && glyph.components.length === 0;

  return glyph;
}

function parseSimpleGlyph(
  reader: BinaryReader,
  glyph: RawGlyph,
  numberOfContours: number,
  end: number,
): void {
  if (numberOfContours === 0) {
    glyph.isEmpty = true;
    return;
  }

  const endPts: number[] = [];
  for (let i = 0; i < numberOfContours; i++) endPts.push(reader.uint16());

  const instructionLength = reader.uint16();
  glyph.instructionLength = instructionLength;
  reader.skip(instructionLength);

  const pointCount = endPts[endPts.length - 1] + 1;
  const flags: number[] = [];
  for (let i = 0; i < pointCount; ) {
    const flag = reader.uint8();
    flags.push(flag);
    if (flag & REPEAT) {
      let repeats = reader.uint8();
      while (repeats > 0 && i < pointCount) {
        flags.push(flag);
        i++;
        repeats--;
      }
      i++;
    } else {
      i++;
    }
  }

  glyph.hasOverlap = (flags[0] & OVERLAP_SIMPLE) !== 0;

  const xs: number[] = new Array(pointCount);
  let value = 0;
  for (let i = 0; i < pointCount; i++) {
    const flag = flags[i];
    if (flag & X_SHORT) {
      const delta = reader.uint8();
      value += flag & X_SAME_OR_POSITIVE ? delta : -delta;
    } else if (!(flag & X_SAME_OR_POSITIVE)) {
      value += reader.int16();
    }
    xs[i] = value;
  }

  const ys: number[] = new Array(pointCount);
  value = 0;
  for (let i = 0; i < pointCount; i++) {
    const flag = flags[i];
    if (flag & Y_SHORT) {
      const delta = reader.uint8();
      value += flag & Y_SAME_OR_POSITIVE ? delta : -delta;
    } else if (!(flag & Y_SAME_OR_POSITIVE)) {
      value += reader.int16();
    }
    ys[i] = value;
  }

  const points: GlyphPoint[] = new Array(pointCount);
  for (let i = 0; i < pointCount; i++) {
    points[i] = {
      x: xs[i],
      y: ys[i],
      onCurve: (flags[i] & ON_CURVE) !== 0,
      lastPointOfContour: false,
    };
  }

  const contours: GlyphContour[] = [];
  let start = 0;
  for (const endIndex of endPts) {
    points[endIndex].lastPointOfContour = true;
    contours.push({
      points: points.slice(start, endIndex + 1),
      startIndex: start,
      endIndex,
    });
    start = endIndex + 1;
  }

  glyph.points = points;
  glyph.contours = contours;
  glyph.isEmpty = false;
  void end;
}

function parseCompositeGlyph(
  reader: BinaryReader,
  glyph: RawGlyph,
  end: number,
): void {
  let flags = MORE_COMPONENTS;

  while (flags & MORE_COMPONENTS) {
    if (reader.position >= end) break;
    flags = reader.uint16();
    const glyphId = reader.uint16();

    let arg1: number;
    let arg2: number;
    if (flags & ARG_1_AND_2_ARE_WORDS) {
      arg1 = reader.int16();
      arg2 = reader.int16();
    } else {
      arg1 = reader.int8();
      arg2 = reader.int8();
    }

    if (!(flags & ARGS_ARE_XY_VALUES)) {
      // Point-matching placement is vanishingly rare; keep the raw args.
      arg1 = reader.uint16();
      arg2 = reader.uint16();
    }

    let transform: [number, number, number, number] = [1, 0, 0, 1];
    if (flags & WE_HAVE_A_SCALE) {
      const scale = reader.fixed();
      transform = [scale, 0, 0, scale];
    } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
      transform = [reader.fixed(), 0, 0, reader.fixed()];
    } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
      transform = [
        reader.fixed(),
        reader.fixed(),
        reader.fixed(),
        reader.fixed(),
      ];
    }

    glyph.components.push({
      glyphId,
      x: arg1,
      y: arg2,
      transform,
      unscaledOffset: (flags & UNSCALED_COMPONENT_OFFSET) !== 0,
      useMyMetrics: (flags & USE_MY_METRICS) !== 0,
    });
    void SCALED_COMPONENT_OFFSET;
  }

  if (flags & WE_HAVE_INSTRUCTIONS) {
    const instructionLength = reader.uint16();
    glyph.instructionLength = instructionLength;
  }
}
