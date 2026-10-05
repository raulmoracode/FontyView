import { BinaryReader } from "../binary-reader";

/**
 * OpenType Layout common table format, shared by GSUB and GPOS.
 *
 * Only the parts needed to report which features a font actually implements
 * are decoded: script/language systems, feature tags and lookup types. No
 * glyph substitution is performed here.
 */

export type LookupType = {
  /** True when this lookup only wraps another one behind a 32-bit offset. */
  isExtension: boolean;
  lookupType: number;
  lookupFlag: number;
  markFilteringSet: number | null;
};

export type ScriptRecord = {
  tag: string;
  /** Default language system tag, e.g. `dflt`, or null when absent. */
  defaultLanguage: string | null;
  /** Number of language systems reachable from this script. */
  languageCount: number;
};

export type FeatureRecord = {
  tag: string;
  /** Lookup indices this feature points at. */
  lookupIndices: number[];
  featureParams: number | null;
};

/** One ligature the font can build, with the components it is made from. */
export type Ligature = {
  /** The glyph the sequence substitutes to. */
  glyphId: number;
  /** Glyph IDs of the components, in order. */
  components: number[];
  /** The lookup that holds this ligature. */
  lookupIndex: number;
};

export type LayoutTable = {
  kind: "GSUB" | "GPOS";
  majorVersion: number;
  minorVersion: number;
  scripts: ScriptRecord[];
  features: FeatureRecord[];
  lookups: LookupType[];
  /** Ligatures found in substitution lookups. GSUB only. */
  ligatures: Ligature[];
};

const LOOKUP_TYPE_NAMES: Record<number, string> = {
  1: "Single substitution",
  2: "Multiple substitution",
  3: "Alternate substitution",
  4: "Ligature substitution",
  5: "Contextual substitution",
  6: "Chaining contextual substitution",
  7: "Extension substitution",
  8: "Reverse chaining contextual single substitution",
  9: "Single positioning",
  10: "Pair positioning",
  11: "Cursive positioning",
  12: "Mark to base positioning",
  13: "Mark to ligature positioning",
  14: "Mark to mark positioning",
};

export function lookupTypeName(lookupType: number): string {
  return LOOKUP_TYPE_NAMES[lookupType] ?? `Lookup type ${lookupType}`;
}

/** Feature tags registered with the OpenType consortium. */
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  aalt: "Access all alternates",
  abvf: "Above-base form",
  abvm: "Above-base mark positioning",
  abvs: "Above-base substitutions",
  afrc: "Alternative fractions",
  akhn: "Akhand",
  blwf: "Below-base form",
  blwm: "Below-base mark positioning",
  blws: "Below-base substitutions",
  c2pc: "Petite capitals from capitals",
  c2sc: "Small capitals from capitals",
  calt: "Contextual alternates",
  case: "Case-sensitive forms",
  ccmp: "Glyph composition and decomposition",
  cfar: "Conjunct form",
  chws: "Contextual half-width spacing",
  cjct: "Conjunct forms",
  clig: "Contextual ligatures",
  cpct: "Centered CJK punctuation",
  cpsp: "Capital spacing",
  cswh: "Contextual swash",
  curs: "Cursive positioning",
  dlig: "Discretionary ligatures",
  dnom: "Diamond ornaments",
  dtls: "Dotless forms",
  expt: "Expert forms",
  falt: "Final glyph on line alternates",
  fin2: "Terminal forms 2",
  fin3: "Terminal forms 3",
  fina: "Terminal forms",
  flac: "Flattened accent forms",
  frac: "Fractions",
  fwid: "Full widths",
  half: "Half forms",
  haln: "Halant forms",
  halt: "Alternate half widths",
  hist: "Historical forms",
  hkna: "Horizontal kana alternating",
  hlig: "Historical ligatures",
  hngl: "Hangul",
  hojo: "Hojo kanji forms",
  hwid: "Half widths",
  init: "Initial forms",
  isol: "Isolated forms",
  ital: "Italics",
  jalt: "Justification alternates",
  jp78: "JIS78 forms",
  jp83: "JIS83 forms",
  jp90: "JIS90 forms",
  jp04: "JIS2004 forms",
  kern: "Kerning",
  lfbd: "Left bounds",
  liga: "Standard ligatures",
  ljmp: "Leading jambi forms",
  lnum: "Lining figures",
  locl: "Localised forms",
  ltra: "Left-to-right alternates",
  ltrm: "Left-to-right mirrored forms",
  mark: "Mark positioning",
  med2: "Medial forms 2",
  med3: "Medial forms 3",
  medi: "Medial forms",
  mgrk: "Mathematical Greek",
  mkmk: "Mark to mark positioning",
  msam: "Mathematical ams",
  mslf: "Mathematical literal",
  msinf: "Mathematical Greek lowercase",
  msu1: "Mathematical Greek uppercase",
  msu2: "Mathematical Greek bold",
  msu3: "Mathematical Greek bold italic",
  msu4: "Mathematical Greek italic",
  msu5: "Mathematical Greek bold italic",
  msu6: "Mathematical Greek sans serif",
  msu7: "Mathematical Greek sans serif bold",
  msu8: "Mathematical Greek sans serif italic",
  msu9: "Mathematical Greek sans serif bold italic",
  munr: "Mathematical numerals",
  nalt: "Alternate annotation forms",
  nlck: "NLC kanji forms",
  nukt: "Nukta forms",
  numr: "Numerators",
  onum: "Oldstyle figures",
  opbd: "Optical bounds",
  ordn: "Ordinals",
  ornm: "Ornaments",
  palt: "Proportional alternate widths",
  pcap: "Petite capitals",
  pkna: "Proportional Kana",
  pnum: "Proportional figures",
  pref: "Pre-base forms",
  pres: "Pre-base substitutions",
  pstf: "Post-base form",
  psts: "Post-base substitutions",
  pwid: "Proportional widths",
  qwid: "Quarter widths",
  rand: "Randomize",
  rclt: "Required contextual alternates",
  rkrf: "Rakar forms",
  rlig: "Required ligatures",
  rphf: "Reph form",
  rtbd: "Right bounds",
  rtla: "Right-to-left alternates",
  rtlm: "Right-to-left mirrored forms",
  ruby: "Ruby notation forms",
  rvrn: "Required variation alternates",
  salt: "Stylistic alternates",
  sinf: "Scientific inferiors",
  smcp: "Small capitals",
  smpl: "Simplified forms",
  ssty: "Math script style alternates",
  stch: "Stretching glyph decomposition",
  subs: "Subscript",
  sups: "Superscript",
  swsh: "Swash",
  titl: "Titling",
  tjmo: "Tatweel justification",
  tnam: "Traditional name forms",
  tnum: "Tabular figures",
  trad: "Traditional forms",
  twid: "Third width",
  unic: "Unicase",
  valt: "Alternate vertical metrics",
  vapk: "Kerning for alternate proportional vertical metrics",
  vatu: "Vattu variants",
  vchw: "Vertical contextual half-width spacing",
  vert: "Vertical alternates",
  vhal: "Alternate vertical half metrics",
  vjmo: "Vowel jamo forms",
  vkna: "Vertical kana alternates",
  vkrn: "Vertical kerning",
  vpal: "Proportional alternate vertical metrics",
  vrt2: "Vertical alternates and rotation",
  vrtr: "Vertical alternates for rotation",
  zero: "Slashed zero",
};

/** Stylistic sets and character variants are registered as a numeric series. */
const SERIES: { pattern: RegExp; label: (n: number) => string }[] = [
  { pattern: /^ss(\d{2})$/, label: (n) => `Stylistic set ${n}` },
  {
    pattern: /^cv(\d{2})$/,
    label: (n) => `Character variant ${n}`,
  },
];

export function featureDescription(tag: string): string {
  const direct = FEATURE_DESCRIPTIONS[tag];
  if (direct) return direct;

  for (const series of SERIES) {
    const match = series.pattern.exec(tag);
    if (match) return series.label(Number(match[1]));
  }

  return "Unregistered feature";
}

export function isRegisteredFeature(tag: string): boolean {
  if (tag in FEATURE_DESCRIPTIONS) return true;
  return SERIES.some((series) => series.pattern.test(tag));
}

/** Features that are meaningful to switch on or off in a specimen. */
export const TOGGLEABLE_FEATURES = [
  "liga",
  "dlig",
  "clig",
  "rlig",
  "calt",
  "rclt",
  "smcp",
  "c2sc",
  "pcap",
  "c2pc",
  "onum",
  "lnum",
  "tnum",
  "pnum",
  "frac",
  "afrc",
  "zero",
  "case",
  "ss01",
  "ss02",
  "ss03",
  "ss04",
  "ss05",
  "ss06",
  "ss07",
  "ss08",
  "ss09",
  "ss10",
];

/** Coverage as a list of glyph IDs, expanding format 2 ranges. */
function coverageGlyphs(bytes: Uint8Array, offset: number): number[] {
  const reader = new BinaryReader(bytes).seek(offset);
  const format = reader.uint16();
  const glyphs: number[] = [];

  if (format === 1) {
    const count = reader.uint16();
    for (let i = 0; i < count; i++) glyphs.push(reader.uint16());
  } else if (format === 2) {
    const rangeCount = reader.uint16();
    for (let i = 0; i < rangeCount; i++) {
      const start = reader.uint16();
      const end = reader.uint16();
      const startIndex = reader.uint16();
      for (let glyph = start; glyph <= end; glyph++) {
        glyphs.push(startIndex + (glyph - start));
      }
    }
  }

  return glyphs;
}

function readCoverage(reader: BinaryReader): { start: number; end: number }[] {
  const format = reader.uint16();
  const ranges: { start: number; end: number }[] = [];

  if (format === 1) {
    const count = reader.uint16();
    for (let i = 0; i < count; i++) {
      ranges.push({ start: reader.uint16(), end: reader.uint16() });
    }
  } else if (format === 2) {
    const count = reader.uint16();
    for (let i = 0; i < count; i++) {
      ranges.push({ start: reader.uint16(), end: reader.uint16() });
      reader.uint16(); // startCoverageIndex
    }
  }

  return ranges;
}

/**
 * Reads a ligature substitution subtable (lookup type 4) and returns every
 * ligature it can build, with the component glyphs in order.
 */
function readLigatureSubtable(
  bytes: Uint8Array,
  offset: number,
  lookupIndex: number,
): Ligature[] {
  const ligatures: Ligature[] = [];
  const reader = new BinaryReader(bytes).seek(offset);
  const format = reader.uint16();
  if (format !== 1) return ligatures;

  const coverageOffset = reader.uint16();
  const coverage = coverageGlyphs(bytes, offset + coverageOffset);
  const setCount = reader.uint16();
  const setOffsets: number[] = [];
  for (let i = 0; i < setCount; i++) setOffsets.push(reader.uint16());

  for (let i = 0; i < setCount; i++) {
    const first = coverage[i];
    if (first === undefined) continue;
    const set = new BinaryReader(bytes).seek(offset + setOffsets[i]);
    const ligatureCount = set.uint16();
    for (let l = 0; l < ligatureCount; l++) {
      const glyphId = set.uint16();
      const componentCount = set.uint16();
      // The first component is the one the coverage table points at.
      const components = [first];
      for (let c = 1; c < componentCount; c++) components.push(set.uint16());
      ligatures.push({ glyphId, components, lookupIndex });
    }
  }

  return ligatures;
}

/** Skips a lookup's subtables, reporting only the type and flag. */
/**
 * Walks one substitution or positioning subtable, keeping whatever it can
 * learn about it. Both a plain subtable and the subtable an extension lookup
 * points at come through here, so the two paths cannot drift apart.
 */
function walkSubtable(
  bytes: Uint8Array,
  absolute: number,
  lookupType: number,
  ligatures: Ligature[],
  lookupIndex: number,
): void {
  const sub = new BinaryReader(bytes).seek(absolute);

  if (
    lookupType === 1 ||
    lookupType === 2 ||
    lookupType === 3 ||
    lookupType === 9 ||
    lookupType === 10
  ) {
    // Single, multiple, alternate and contextual substitution, and pair
    // positioning, all start with a format and a coverage offset.
    sub.uint16();
    const coverageOffset = sub.uint16();
    if (absolute + coverageOffset < bytes.byteLength) {
      readCoverage(new BinaryReader(bytes).seek(absolute + coverageOffset));
    }
  } else if (lookupType === 4) {
    ligatures.push(...readLigatureSubtable(bytes, absolute, lookupIndex));
  } else if (lookupType === 11 || lookupType === 12 || lookupType === 13) {
    // Cursive and mark attachment share a header shape.
    sub.uint16();
    readCoverage(new BinaryReader(bytes).seek(absolute + sub.uint16()));
    sub.uint16(); // markArray
    sub.uint16(); // baseArray
    sub.uint16(); // ligatureArray
    sub.uint16(); // mark2Array
  }
}

/**
 * Reads a lookup's header and walks each of its subtables. `extensionType` is
 * 7 for GSUB and 9 for GPOS: the same number means contextual substitution in
 * GSUB and extension in GPOS, so the caller has to say which table it is
 * reading.
 */
function readLookup(
  bytes: Uint8Array,
  offset: number,
  size: 2 | 4,
  ligatures: Ligature[],
  lookupIndex: number,
  extensionType: number,
): LookupType | null {
  try {
    const reader = new BinaryReader(bytes).seek(offset);
    const lookupType = reader.uint16();
    const lookupFlag = reader.uint16();
    const subTableCount = reader.uint16();

    const isExtension = lookupType === extensionType;

    if (subTableCount === 0) {
      return { lookupType, lookupFlag, markFilteringSet: null, isExtension };
    }

    const subtableOffsets: number[] = [];
    for (let i = 0; i < subTableCount; i++) {
      subtableOffsets.push(size === 2 ? reader.uint16() : reader.uint32());
    }

    let markFilteringSet: number | null = null;
    if (lookupFlag & 0x0010) {
      markFilteringSet = size === 2 ? reader.uint16() : reader.uint32();
    }

    // Walking each subtable proves the structure is coherent; a lookup we
    // cannot walk is reported as a type with no detail rather than guessed at.
    for (const subtableOffset of subtableOffsets) {
      const absolute = offset + subtableOffset;
      if (absolute >= bytes.byteLength) return null;

      if (isExtension) {
        // An extension lookup wraps a subtable of the type named in its
        // header, behind a 32-bit offset.
        const sub = new BinaryReader(bytes).seek(absolute);
        sub.uint16(); // format
        const extendedType = sub.uint16();
        walkSubtable(
          bytes,
          absolute + sub.uint32(),
          extendedType,
          ligatures,
          lookupIndex,
        );
      } else {
        walkSubtable(bytes, absolute, lookupType, ligatures, lookupIndex);
      }
    }

    return { lookupType, lookupFlag, markFilteringSet, isExtension };
  } catch {
    return null;
  }
}

export function parseLayoutTable(
  bytes: Uint8Array,
  kind: "GSUB" | "GPOS",
): LayoutTable {
  const reader = new BinaryReader(bytes);
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const scriptListOffset = reader.uint16();
  const featureListOffset = reader.uint16();
  const lookupListOffset = reader.uint16();

  const scripts: ScriptRecord[] = [];
  if (scriptListOffset > 0) {
    const scriptReader = new BinaryReader(bytes).seek(scriptListOffset);
    const scriptCount = scriptReader.uint16();
    for (let i = 0; i < scriptCount; i++) {
      const tag = scriptReader.tag();
      const offset = scriptReader.uint16();
      const script = new BinaryReader(bytes).seek(scriptListOffset + offset);
      const defaultLanguage = script.uint16();
      const languageCount = script.uint16();
      scripts.push({
        tag,
        defaultLanguage: defaultLanguage > 0 ? "dflt" : null,
        languageCount,
      });
    }
  }

  const features: FeatureRecord[] = [];
  if (featureListOffset > 0) {
    const featureReader = new BinaryReader(bytes).seek(featureListOffset);
    const featureCount = featureReader.uint16();
    for (let i = 0; i < featureCount; i++) {
      const tag = featureReader.tag();
      const offset = featureReader.uint16();
      const feature = new BinaryReader(bytes).seek(featureListOffset + offset);
      const featureParams = feature.uint16();
      const lookupIndexCount = feature.uint16();
      const lookupIndices: number[] = [];
      for (let l = 0; l < lookupIndexCount; l++)
        lookupIndices.push(feature.uint16());
      features.push({ tag, lookupIndices, featureParams });
    }
  }

  const extensionType = kind === "GSUB" ? 7 : 9;
  const ligatures: Ligature[] = [];
  const lookups: LookupType[] = [];
  if (lookupListOffset > 0) {
    const lookupReader = new BinaryReader(bytes).seek(lookupListOffset);
    const lookupCount = lookupReader.uint16();
    const offsets: number[] = [];
    for (let i = 0; i < lookupCount; i++) offsets.push(lookupReader.uint16());

    for (let i = 0; i < lookupCount; i++) {
      const lookup = readLookup(
        bytes,
        lookupListOffset + offsets[i],
        2,
        ligatures,
        i,
        extensionType,
      );
      lookups.push(
        lookup ?? {
          lookupType: -1,
          lookupFlag: 0,
          markFilteringSet: null,
          isExtension: false,
        },
      );
    }
  }

  return {
    kind,
    majorVersion,
    minorVersion,
    scripts,
    features,
    lookups,
    ligatures,
  };
}
