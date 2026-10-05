/**
 * Minimal TrueType writer used only by the test suite.
 *
 * opentype.js can emit CFF outlines but not `glyf`, so the container decoders
 * need a hand-built TrueType font to exercise the WOFF2 `glyf`/`loca`/`hmtx`
 * transforms. Producing the font in memory keeps third-party binaries out of
 * the repository.
 */

const UNITS_PER_EM = 1000;

type Writer = {
  bytes: number[];
  u8(value: number): void;
  u16(value: number): void;
  i16(value: number): void;
  u32(value: number): void;
  tag(value: string): void;
  raw(bytes: number[] | Uint8Array): void;
  done(): Uint8Array;
};

function writer(): Writer {
  const bytes: number[] = [];
  return {
    bytes,
    u8(value) {
      bytes.push(value & 0xff);
    },
    u16(value) {
      bytes.push((value >> 8) & 0xff, value & 0xff);
    },
    i16(value) {
      this.u16(value < 0 ? value + 0x10000 : value);
    },
    u32(value) {
      bytes.push(
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
      );
    },
    tag(value) {
      for (let i = 0; i < 4; i++) bytes.push(value.charCodeAt(i));
    },
    raw(data) {
      for (const byte of data) bytes.push(byte & 0xff);
    },
    done() {
      while (bytes.length % 4 !== 0) bytes.push(0);
      return new Uint8Array(bytes);
    },
  };
}

type Point = { x: number; y: number; onCurve: boolean };
type GlyphSpec =
  | { kind: "empty" }
  | { kind: "simple"; contours: Point[][]; advance: number }
  | {
      kind: "composite";
      parts: { glyphId: number; dx: number; dy: number }[];
      advance: number;
    };

/** Encodes one simple glyph, including the on/off curve point flags. */
function encodeSimple(contours: Point[][]): Uint8Array {
  const out = writer();
  const points = contours.flat();

  let xMin = 0;
  let yMin = 0;
  let xMax = 0;
  let yMax = 0;
  for (const [index, point] of points.entries()) {
    if (index === 0) {
      xMin = xMax = point.x;
      yMin = yMax = point.y;
      continue;
    }
    xMin = Math.min(xMin, point.x);
    yMin = Math.min(yMin, point.y);
    xMax = Math.max(xMax, point.x);
    yMax = Math.max(yMax, point.y);
  }

  out.i16(contours.length);
  out.i16(xMin);
  out.i16(yMin);
  out.i16(xMax);
  out.i16(yMax);

  let endPoint = -1;
  for (const contour of contours) {
    endPoint += contour.length;
    out.u16(endPoint);
  }
  out.u16(0); // instructionLength

  const flags: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  let lastX = 0;
  let lastY = 0;
  for (const point of points) {
    let flag = point.onCurve ? 1 : 0;
    const dx = point.x - lastX;
    const dy = point.y - lastY;
    if (dx === 0) {
      flag |= 0x10;
    } else if (dx > -256 && dx < 256) {
      flag |= 0x02 | (dx > 0 ? 0x10 : 0);
      xs.push(Math.abs(dx));
    } else {
      xs.push(dx);
    }
    if (dy === 0) {
      flag |= 0x20;
    } else if (dy > -256 && dy < 256) {
      flag |= 0x04 | (dy > 0 ? 0x20 : 0);
      ys.push(Math.abs(dy));
    } else {
      ys.push(dy);
    }
    flags.push(flag);
    lastX = point.x;
    lastY = point.y;
  }
  for (const flag of flags) out.u8(flag);
  for (const dx of xs) {
    if (dx > -256 && dx < 256) out.u8(Math.abs(dx));
    else out.i16(dx);
  }
  for (const dy of ys) {
    if (dy > -256 && dy < 256) out.u8(Math.abs(dy));
    else out.i16(dy);
  }

  return out.done();
}

function encodeComposite(
  parts: { glyphId: number; dx: number; dy: number }[],
): Uint8Array {
  const out = writer();
  out.i16(-1);
  out.i16(0);
  out.i16(0);
  out.i16(UNITS_PER_EM);
  out.i16(UNITS_PER_EM);

  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    out.u16(0x0001 | 0x0002 | (last ? 0 : 0x0020));
    out.u16(part.glyphId);
    out.i16(part.dx);
    out.i16(part.dy);
  });
  out.u16(0); // instructionLength

  return out.done();
}

function buildCmap(entries: [number, number][]): Uint8Array {
  const sorted = [...entries].sort((a, b) => a[0] - b[0]);

  interface Segment {
    start: number;
    end: number;
    delta: number;
  }
  const segments: Segment[] = [];
  for (const [code, glyphId] of sorted) {
    const last = segments[segments.length - 1];
    if (last && code === last.end + 1 && glyphId - code === last.delta) {
      last.end = code;
      continue;
    }
    segments.push({ start: code, end: code, delta: glyphId - code });
  }
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 });

  const segCount = segments.length;
  const length = 16 + segCount * 8;
  const sub = writer();
  sub.u16(4);
  sub.u16(length);
  sub.u16(0);
  sub.u16(segCount * 2);
  const entrySelector = Math.floor(Math.log2(segCount));
  sub.u16(2 ** entrySelector * 2);
  sub.u16(entrySelector);
  sub.u16(segCount * 2 - 2 ** entrySelector * 2);
  for (const segment of segments) sub.u16(segment.end);
  sub.u16(0);
  for (const segment of segments) sub.u16(segment.start);
  for (const segment of segments) sub.i16(segment.delta);
  for (const _ of segments) sub.u16(0);
  const subtable = sub.bytes;

  const out = writer();
  out.u16(0);
  out.u16(1);
  out.u16(3);
  out.u16(1);
  out.u32(12);
  out.raw(subtable);
  return out.done();
}

function buildName(
  family: string,
  subfamily: string,
  version: string,
): Uint8Array {
  const records: { id: number; value: string }[] = [
    { id: 1, value: family },
    { id: 2, value: subfamily },
    { id: 4, value: `${family} ${subfamily}` },
    { id: 5, value: version },
    { id: 6, value: `${family}-${subfamily}` },
  ];

  const strings = writer();
  const offsets: { id: number; length: number; offset: number }[] = [];
  for (const record of records) {
    const encoded: number[] = [];
    for (let i = 0; i < record.value.length; i++) {
      const code = record.value.charCodeAt(i);
      encoded.push((code >> 8) & 0xff, code & 0xff);
    }
    offsets.push({
      id: record.id,
      length: encoded.length,
      offset: strings.bytes.length,
    });
    strings.raw(encoded);
  }

  const out = writer();
  out.u16(0);
  out.u16(records.length);
  out.u16(6 + records.length * 12);
  for (const entry of offsets) {
    out.u16(3); // Windows
    out.u16(1); // Unicode BMP
    out.u16(0x0409); // en-US
    out.u16(entry.id);
    out.u16(entry.length);
    out.u16(entry.offset);
  }
  out.raw(strings.bytes);
  return out.done();
}

function checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const value =
      ((bytes[i] << 24) |
        ((bytes[i + 1] ?? 0) << 16) |
        ((bytes[i + 2] ?? 0) << 8) |
        (bytes[i + 3] ?? 0)) >>>
      0;
    sum = (sum + value) >>> 0;
  }
  return sum;
}

const GLYPHS: GlyphSpec[] = [
  { kind: "empty" },
  {
    kind: "simple",
    advance: 600,
    contours: [
      [
        { x: 100, y: 0, onCurve: true },
        { x: 300, y: 700, onCurve: false },
        { x: 500, y: 0, onCurve: true },
      ],
    ],
  },
  {
    kind: "simple",
    advance: 560,
    contours: [
      [
        { x: 0, y: 0, onCurve: true },
        { x: 500, y: 0, onCurve: true },
        { x: 500, y: 500, onCurve: true },
        { x: 0, y: 500, onCurve: true },
      ],
      // A second contour, so multi-contour and repeat-flag paths are covered.
      [
        { x: 100, y: 100, onCurve: true },
        { x: 200, y: 100, onCurve: true },
        { x: 200, y: 200, onCurve: true },
      ],
    ],
  },
  // A composite glyph, which WOFF2 stores in its own substream.
  {
    kind: "composite",
    advance: 1160,
    parts: [
      { glyphId: 1, dx: 0, dy: 0 },
      { glyphId: 2, dx: 600, dy: 0 },
    ],
  },
  {
    kind: "simple",
    advance: 700,
    contours: [
      [
        { x: 50, y: 50, onCurve: true },
        { x: 900, y: 50, onCurve: true },
        { x: 900, y: 400, onCurve: false },
        { x: 50, y: 400, onCurve: true },
      ],
    ],
  },
];

/** A spec-valid TrueType font with TrueType outlines, built in memory. */

/**
 * A minimal but coherent GSUB table: three features wired to three different
 * lookup types, so the layout parser has real structure to read. Offsets are
 * computed from the assembled sizes rather than hand-counted.
 */
function buildGsub(): Uint8Array {
  const langsys = (() => {
    const w = writer();
    w.u16(0); // lookupOrderOffset
    w.u16(0xffff); // requiredFeatureIndex
    w.u16(2); // featureIndexCount
    w.u16(0);
    w.u16(1);
    return w.done();
  })();

  const script = (() => {
    const w = writer();
    const langsysOffset = 10;
    w.u16(langsysOffset); // defaultLangSysOffset
    w.u16(1); // langSysCount
    w.tag("dflt");
    w.u16(langsysOffset);
    w.raw(langsys);
    return w.done();
  })();

  const scriptList = (() => {
    const w = writer();
    w.u16(1);
    w.tag("DFLT");
    // Offset from the start of the script list, past its own record.
    w.u16(8);
    w.raw(script);
    return w.done();
  })();

  const featureTable = (() => {
    const w = writer();
    w.u16(0); // featureParams
    w.u16(1); // lookupIndexCount
    w.u16(0); // lookupListIndex
    return w.done();
  })();

  const featureList = (() => {
    const count = 3;
    const headerSize = 2 + count * 6;
    const w = writer();
    w.u16(count);
    const tags = ["liga", "kern", "ss01"];
    tags.forEach((tag, index) => {
      const [a, b, c, d] = [
        tag.charCodeAt(0),
        tag.charCodeAt(1),
        tag.charCodeAt(2),
        tag.charCodeAt(3),
      ];
      w.u16((a << 8) | b);
      w.u16((c << 8) | d);
      w.u16(headerSize + index * featureTable.byteLength);
    });
    for (let i = 0; i < count; i++) w.raw(featureTable);
    return w.done();
  })();

  // Lookup 0: ligature substitution, f + i -> fi.
  const ligatureLookup = (() => {
    const w = writer();
    w.u16(4);
    w.u16(0);
    w.u16(1); // subtableCount
    w.u16(8); // subtable offset
    // coverage format 1
    w.u16(1);
    w.u16(2);
    w.u16(1);
    w.u16(2);
    // ligature set
    w.u16(1);
    w.u16(8);
    w.u16(1); // ligatureCount
    w.u16(1); // component glyph 2
    w.u16(3); // ligature glyph 3
    return w.done();
  })();

  // Lookup 1: single positioning with an x-advance of -20.
  const positioningLookup = (() => {
    const w = writer();
    w.u16(9);
    w.u16(0);
    w.u16(1);
    w.u16(8);
    w.u16(1); // format 1
    w.u16(8); // coverage offset
    w.u16(1); // valueFormat: xAdvance
    w.u16(1); // pairSetCount
    w.u16(1); // pairSet offset
    w.u16(0); // secondGlyph
    w.i16(-20); // xAdvance
    return w.done();
  })();

  // Lookup 2: extension substitution wrapping a single substitution.
  const extensionLookup = (() => {
    const w = writer();
    w.u16(7);
    w.u16(0);
    w.u16(1);
    w.u16(8);
    w.u16(1); // format 1
    w.u16(1); // extensionLookupType
    w.u16(12); // extension offset
    // Wrapped single substitution subtable.
    w.u16(1);
    w.u16(8); // coverage offset
    w.u16(1); // format 1
    w.u16(2); // deltaGlyphID
    return w.done();
  })();

  const lookupList = (() => {
    const lookups = [ligatureLookup, positioningLookup, extensionLookup];
    const headerSize = 2 + lookups.length * 2;
    const w = writer();
    w.u16(lookups.length);
    let offset = headerSize;
    for (const lookup of lookups) {
      w.u16(offset);
      offset += lookup.byteLength;
    }
    for (const lookup of lookups) w.raw(lookup);
    return w.done();
  })();

  const headerSize = 14; // 10 header bytes plus a 4-byte featureVariationsOffset
  const w = writer();
  w.u16(1);
  w.u16(1);
  w.u16(headerSize); // scriptListOffset
  w.u16(headerSize + scriptList.byteLength); // featureListOffset
  w.u16(headerSize + scriptList.byteLength + featureList.byteLength); // lookupListOffset
  w.u32(0); // featureVariationsOffset
  w.raw(scriptList);
  w.raw(featureList);
  w.raw(lookupList);
  return w.done();
}

export function buildTrueTypeFont(options?: {
  gsub?: boolean;
}): Uint8Array<ArrayBuffer> {
  const numGlyphs = GLYPHS.length;
  const cmapEntries: [number, number][] = [
    [0x41, 1],
    [0x42, 2],
    [0xe9, 4],
  ];

  const glyf = writer();
  const locaOffsets: number[] = [];
  for (const glyph of GLYPHS) {
    locaOffsets.push(glyf.bytes.length);
    const encoded =
      glyph.kind === "empty"
        ? new Uint8Array(0)
        : glyph.kind === "simple"
          ? encodeSimple(glyph.contours)
          : encodeComposite(glyph.parts);
    glyf.raw(encoded);
    // Glyph records are padded to a 4-byte boundary.
    while (glyf.bytes.length % 4 !== 0) glyf.bytes.push(0);
  }
  locaOffsets.push(glyf.bytes.length);
  const glyfBytes = glyf.done();

  const loca = writer();
  for (const offset of locaOffsets) loca.u32(offset);
  const locaBytes = loca.done();

  const hmtx = writer();
  let lastAdvance = 0;
  for (const glyph of GLYPHS) {
    if (glyph.kind !== "empty") {
      lastAdvance = glyph.advance;
      hmtx.u16(lastAdvance);
    } else {
      hmtx.u16(lastAdvance);
    }
    hmtx.i16(0);
  }
  const hmtxBytes = hmtx.done();

  const head = writer();
  head.u32(0x0001_0000);
  head.u32(0x0001_0000);
  head.u32(0); // checkSumAdjustment, patched below
  head.u32(0x5f0f_3cf5);
  head.u16(0b11);
  head.u16(UNITS_PER_EM);
  head.u32(0);
  head.u32(0);
  head.u32(0);
  head.u32(0);
  head.i16(0);
  head.i16(0);
  head.i16(UNITS_PER_EM);
  head.i16(UNITS_PER_EM);
  head.u16(0); // macStyle
  head.u16(8); // lowestRecPPEM
  head.i16(2); // fontDirectionHint
  head.i16(1); // indexToLocFormat: long
  head.i16(0); // glyphDataFormat
  const headBytes = head.done();

  const hhea = writer();
  hhea.u32(0x0001_0000);
  hhea.i16(800); // ascender
  hhea.i16(-200); // descender
  hhea.i16(90); // lineGap
  hhea.u16(UNITS_PER_EM); // advanceWidthMax
  hhea.i16(0); // minLeftSideBearing
  hhea.i16(0); // minRightSideBearing
  hhea.i16(UNITS_PER_EM); // xMaxExtent
  hhea.i16(1); // caretSlopeRise
  hhea.i16(0); // caretSlopeRun
  hhea.i16(0); // caretOffset
  for (let i = 0; i < 4; i++) hhea.i16(0);
  hhea.u16(0); // metricDataFormat
  hhea.u16(numGlyphs); // numberOfHMetrics
  const hheaBytes = hhea.done();

  const maxp = writer();
  maxp.u32(0x0001_0000);
  maxp.u16(numGlyphs);
  for (let i = 0; i < 13; i++) maxp.u16(0);
  const maxpBytes = maxp.done();

  const post = writer();
  post.u32(0x0003_0000);
  post.u32(0);
  post.i16(-100);
  post.i16(50);
  post.u32(0);
  for (let i = 0; i < 4; i++) post.u32(0);
  const postBytes = post.done();

  const tables: { tag: string; data: Uint8Array }[] = [
    { tag: "cmap", data: buildCmap(cmapEntries) },
    { tag: "glyf", data: glyfBytes },
    { tag: "head", data: headBytes },
    { tag: "hhea", data: hheaBytes },
    { tag: "hmtx", data: hmtxBytes },
    { tag: "loca", data: locaBytes },
    { tag: "maxp", data: maxpBytes },
    {
      tag: "name",
      data: buildName("Fixture TrueType", "Regular", "Version 1.000"),
    },
    { tag: "post", data: postBytes },
    ...(options?.gsub ? [{ tag: "GSUB", data: buildGsub() }] : []),
  ].sort((a, b) => (a.tag < b.tag ? -1 : 1));

  const numTables = tables.length;
  const searchRange = 2 ** Math.floor(Math.log2(numTables)) * 16;
  const entrySelector = Math.floor(Math.log2(numTables));
  const directorySize = 12 + numTables * 16;

  let total = directorySize;
  for (const table of tables) {
    total += table.data.byteLength + ((4 - (table.data.byteLength % 4)) % 4);
  }

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x0001_0000);
  view.setUint16(4, numTables);
  view.setUint16(6, searchRange);
  view.setUint16(8, entrySelector);
  view.setUint16(10, numTables * 16 - searchRange);

  let offset = directorySize;
  tables.forEach((table, index) => {
    const entry = 12 + index * 16;
    for (let i = 0; i < 4; i++) out[entry + i] = table.tag.charCodeAt(i);
    view.setUint32(entry + 4, checksum(table.data));
    view.setUint32(entry + 8, offset);
    view.setUint32(entry + 12, table.data.byteLength);
    out.set(table.data, offset);
    offset += table.data.byteLength + ((4 - (table.data.byteLength % 4)) % 4);
  });

  // head.checkSumAdjustment is the file checksum, so it has to be patched in
  // once the layout is final. opentype.js does not verify it, but a valid
  // fixture should not carry a bogus value.
  const headIndex = tables.findIndex((table) => table.tag === "head");
  if (headIndex >= 0) {
    const headEntry = 12 + headIndex * 16;
    const headOffset = view.getUint32(headEntry + 8);
    view.setUint32(headOffset + 8, 0);
    view.setUint32(headEntry + 4, checksum(tables[headIndex].data));
    view.setUint32(headOffset + 8, (0xb1b0_afba - checksum(out)) >>> 0);
  }

  return out;
}
