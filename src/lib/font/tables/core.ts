import { BinaryReader } from "../binary-reader";
import type { Maybe } from "../types";

/** `head` — Font Header. */
export type HeadTable = {
  version: number;
  fontRevision: number;
  checkSumAdjustment: number;
  magicNumber: number;
  flags: number;
  unitsPerEm: number;
  created: string;
  modified: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  macStyle: number;
  lowestRecPPEM: number;
  fontDirectionHint: number;
  indexToLocFormat: number;
  glyphDataFormat: number;
};

const MAC_EPOCH_DIFFERENCE = 2_082_844_800;

function readMacDate(seconds: number): string {
  if (seconds <= 0) return "Not available";
  const date = new Date((seconds - MAC_EPOCH_DIFFERENCE) * 1000);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function parseHead(bytes: Uint8Array): HeadTable {
  const reader = new BinaryReader(bytes);
  const version = reader.fixed();
  const fontRevision = reader.fixed();
  const checkSumAdjustment = reader.uint32();
  const magicNumber = reader.uint32();
  const flags = reader.uint16();
  const unitsPerEm = reader.uint16();
  const created = readMacDate(reader.int64());
  const modified = readMacDate(reader.int64());
  const xMin = reader.int16();
  const yMin = reader.int16();
  const xMax = reader.int16();
  const yMax = reader.int16();
  const macStyle = reader.uint16();
  const lowestRecPPEM = reader.uint16();
  const fontDirectionHint = reader.int16();
  const indexToLocFormat = reader.int16();
  const glyphDataFormat = reader.int16();

  return {
    version,
    fontRevision,
    checkSumAdjustment,
    magicNumber,
    flags,
    unitsPerEm,
    created,
    modified,
    xMin,
    yMin,
    xMax,
    yMax,
    macStyle,
    lowestRecPPEM,
    fontDirectionHint,
    indexToLocFormat,
    glyphDataFormat,
  };
}

/** `hhea` — Horizontal Header. */
export type HheaTable = {
  version: number;
  ascender: number;
  descender: number;
  lineGap: number;
  advanceWidthMax: number;
  minLeftSideBearing: number;
  minRightSideBearing: number;
  xMaxExtent: number;
  caretSlopeRise: number;
  caretSlopeRun: number;
  caretOffset: number;
  metricDataFormat: number;
  numberOfHMetrics: number;
};

export function parseHhea(bytes: Uint8Array): HheaTable {
  const reader = new BinaryReader(bytes);
  const version = reader.fixed();
  const ascender = reader.int16();
  const descender = reader.int16();
  const lineGap = reader.int16();
  const advanceWidthMax = reader.uint16();
  const minLeftSideBearing = reader.int16();
  const minRightSideBearing = reader.int16();
  const xMaxExtent = reader.int16();
  const caretSlopeRise = reader.int16();
  const caretSlopeRun = reader.int16();
  const caretOffset = reader.int16();
  reader.skip(8); // reserved
  const metricDataFormat = reader.int16();
  const numberOfHMetrics = reader.uint16();

  return {
    version,
    ascender,
    descender,
    lineGap,
    advanceWidthMax,
    minLeftSideBearing,
    minRightSideBearing,
    xMaxExtent,
    caretSlopeRise,
    caretSlopeRun,
    caretOffset,
    metricDataFormat,
    numberOfHMetrics,
  };
}

/** `maxp` — Maximum Profile. */
export type MaxpTable = {
  version: number;
  numGlyphs: number;
  maxPoints: number;
  maxContours: number;
  maxCompositePoints: number;
  maxCompositeContours: number;
  maxZones: number;
  maxTwilightPoints: number;
  maxStorage: number;
  maxFunctionDefs: number;
  maxInstructionDefs: number;
  maxStackElements: number;
  maxSizeOfInstructions: number;
  maxComponentElements: number;
  maxComponentDepth: number;
};

export function parseMaxp(bytes: Uint8Array): MaxpTable {
  const reader = new BinaryReader(bytes);
  const version = reader.fixed();
  const numGlyphs = reader.uint16();
  if (version >= 1) {
    return {
      version,
      numGlyphs,
      maxPoints: reader.uint16(),
      maxContours: reader.uint16(),
      maxCompositePoints: reader.uint16(),
      maxCompositeContours: reader.uint16(),
      maxZones: reader.uint16(),
      maxTwilightPoints: reader.uint16(),
      maxStorage: reader.uint16(),
      maxFunctionDefs: reader.uint16(),
      maxInstructionDefs: reader.uint16(),
      maxStackElements: reader.uint16(),
      maxSizeOfInstructions: reader.uint16(),
      maxComponentElements: reader.uint16(),
      maxComponentDepth: reader.uint16(),
    };
  }
  return {
    version,
    numGlyphs,
    maxPoints: 0,
    maxContours: 0,
    maxCompositePoints: 0,
    maxCompositeContours: 0,
    maxZones: 0,
    maxTwilightPoints: 0,
    maxStorage: 0,
    maxFunctionDefs: 0,
    maxInstructionDefs: 0,
    maxStackElements: 0,
    maxSizeOfInstructions: 0,
    maxComponentElements: 0,
    maxComponentDepth: 0,
  };
}

/** `OS/2` — OS/2 and Windows font metrics. */
export type Os2Table = {
  version: number;
  xAvgCharWidth: number;
  usWeightClass: number;
  usWidthClass: number;
  fsType: number;
  ySubscriptXSize: number;
  ySubscriptYSize: number;
  ySubscriptXOffset: number;
  ySubscriptYOffset: number;
  ySuperscriptXSize: number;
  ySuperscriptYSize: number;
  ySuperscriptXOffset: number;
  ySuperscriptYOffset: number;
  yStrikeoutSize: number;
  yStrikeoutPosition: number;
  sFamilyClass: number;
  panose: number[];
  achVendID: string;
  fsSelection: number;
  usFirstCharIndex: number;
  usLastCharIndex: number;
  sTypoAscender: number;
  sTypoDescender: number;
  sTypoLineGap: number;
  usWinAscent: number;
  usWinDescent: number;
  ulCodePageRange1: number;
  ulCodePageRange2: number;
  sxHeight: Maybe<number>;
  sCapHeight: Maybe<number>;
  usDefaultChar: Maybe<number>;
  usBreakChar: Maybe<number>;
  usMaxContext: Maybe<number>;
  usLowerOpticalPointSize: Maybe<number>;
  usUpperOpticalPointSize: Maybe<number>;
};

export function parseOs2(bytes: Uint8Array): Os2Table {
  const reader = new BinaryReader(bytes);
  const version = reader.uint16();
  const xAvgCharWidth = reader.int16();
  const usWeightClass = reader.uint16();
  const usWidthClass = reader.uint16();
  const fsType = reader.uint16();
  const ySubscriptXSize = reader.int16();
  const ySubscriptYSize = reader.int16();
  const ySubscriptXOffset = reader.int16();
  const ySubscriptYOffset = reader.int16();
  const ySuperscriptXSize = reader.int16();
  const ySuperscriptYSize = reader.int16();
  const ySuperscriptXOffset = reader.int16();
  const ySuperscriptYOffset = reader.int16();
  const yStrikeoutSize = reader.int16();
  const yStrikeoutPosition = reader.int16();
  const sFamilyClass = reader.int16();

  const panose: number[] = [];
  for (let i = 0; i < 10; i++) panose.push(reader.uint8());

  const achVendID = reader.tag();
  const fsSelection = reader.uint16();
  const usFirstCharIndex = reader.uint16();
  const usLastCharIndex = reader.uint16();
  const sTypoAscender = reader.int16();
  const sTypoDescender = reader.int16();
  const sTypoLineGap = reader.int16();
  const usWinAscent = reader.uint16();
  const usWinDescent = reader.uint16();

  let ulCodePageRange1 = 0;
  let ulCodePageRange2 = 0;
  if (version >= 1) {
    ulCodePageRange1 = reader.uint32();
    ulCodePageRange2 = reader.uint32();
  }

  let sxHeight: Maybe<number> = null;
  let sCapHeight: Maybe<number> = null;
  let usDefaultChar: Maybe<number> = null;
  let usBreakChar: Maybe<number> = null;
  let usMaxContext: Maybe<number> = null;
  if (version >= 2) {
    sxHeight = reader.int16();
    sCapHeight = reader.int16();
    usDefaultChar = reader.uint16();
    usBreakChar = reader.uint16();
    usMaxContext = reader.uint16();
  }

  let usLowerOpticalPointSize: Maybe<number> = null;
  let usUpperOpticalPointSize: Maybe<number> = null;
  if (version >= 5) {
    usLowerOpticalPointSize = reader.uint16();
    usUpperOpticalPointSize = reader.uint16();
  }

  return {
    version,
    xAvgCharWidth,
    usWeightClass,
    usWidthClass,
    fsType,
    ySubscriptXSize,
    ySubscriptYSize,
    ySubscriptXOffset,
    ySubscriptYOffset,
    ySuperscriptXSize,
    ySuperscriptYSize,
    ySuperscriptXOffset,
    ySuperscriptYOffset,
    yStrikeoutSize,
    yStrikeoutPosition,
    sFamilyClass,
    panose,
    achVendID,
    fsSelection,
    usFirstCharIndex,
    usLastCharIndex,
    sTypoAscender,
    sTypoDescender,
    sTypoLineGap,
    usWinAscent,
    usWinDescent,
    ulCodePageRange1,
    ulCodePageRange2,
    sxHeight,
    sCapHeight,
    usDefaultChar,
    usBreakChar,
    usMaxContext,
    usLowerOpticalPointSize,
    usUpperOpticalPointSize,
  };
}

/** Standard OpenType `name` IDs surfaced in the interface. */
export const NAME_IDS = {
  copyright: 0,
  family: 1,
  subfamily: 2,
  uniqueIdentifier: 3,
  fullName: 4,
  version: 5,
  postScriptName: 6,
  trademark: 7,
  manufacturer: 8,
  designer: 9,
  description: 10,
  vendorUrl: 11,
  designerUrl: 12,
  license: 13,
  licenseUrl: 14,
  reserved: 15,
  typographicFamily: 16,
  typographicSubfamily: 17,
  compatibleFullName: 18,
  sampleText: 19,
  postscriptCidFindfontName: 20,
  wwsFamily: 21,
  wwsSubfamily: 22,
  lightBackgroundPalette: 23,
  darkBackgroundPalette: 24,
  variationsPostScriptPrefix: 25,
} as const;

export const NAME_ID_LABELS: Record<number, string> = {
  0: "Copyright",
  1: "Family Name",
  2: "Subfamily Name",
  3: "Unique Identifier",
  4: "Full Name",
  5: "Version",
  6: "PostScript Name",
  7: "Trademark",
  8: "Manufacturer",
  9: "Designer",
  10: "Description",
  11: "Manufacturer URL",
  12: "Designer URL",
  13: "License",
  14: "License URL",
  15: "Reserved",
  16: "Typographic Family",
  17: "Typographic Subfamily",
  18: "Compatible Full Name",
  19: "Sample Text",
  20: "PostScript CID FindFont Name",
  21: "WWS Family",
  22: "WWS Subfamily",
  23: "Light Background Palette",
  24: "Dark Background Palette",
  25: "Variations PostScript Name Prefix",
  256: "Variations Font Family Name",
  257: "Variations Font Subfamily Name",
  258: "Variations Unique Identifier",
  259: "Variations Full Name",
  260: "Variations Version",
  261: "Variations PostScript Name",
};

export type NameRecord = {
  nameId: number;
  label: string;
  platformId: number;
  platform: string;
  encodingId: number;
  languageId: number;
  language: string;
  value: string;
};

/** The English (or first available) record for each name ID. */
export function pickNames(records: NameRecord[]): Map<number, string> {
  const scored = [...records].sort((a, b) => {
    const platformScore = (platformId: number) =>
      platformId === 3 ? 3 : platformId === 1 ? 2 : platformId === 0 ? 1 : 0;
    const languageScore = (languageId: number) =>
      languageId === 0x0409 || languageId === 0 ? 2 : 1;
    return (
      platformScore(b.platformId) - platformScore(a.platformId) ||
      languageScore(b.languageId) - languageScore(a.languageId)
    );
  });

  const out = new Map<number, string>();
  for (const record of scored) {
    if (record.value.length === 0) continue;
    if (!out.has(record.nameId)) out.set(record.nameId, record.value);
  }
  return out;
}

function platformLabel(platformId: number): string {
  switch (platformId) {
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
      return `Platform ${platformId}`;
  }
}

const MAC_LANGUAGE_NAMES: Record<number, string> = {
  0: "English",
  1: "French",
  2: "German",
  3: "Italian",
  4: "Dutch",
  5: "Swedish",
  6: "Spanish",
  7: "Danish",
  8: "Portuguese",
  9: "Norwegian",
  10: "Hebrew",
  11: "Japanese",
  12: "Arabic",
  13: "Finnish",
  14: "Greek",
  15: "Icelandic",
  16: "Maltese",
  17: "Turkish",
  18: "Croatian",
  24: "Chinese (Traditional)",
  25: "Chinese (Simplified)",
};

function windowsLanguageName(languageId: number): string {
  const primary = languageId & 0x3ff;
  const sub = languageId >> 10;
  const names: Record<number, string> = {
    1: "Arabic",
    2: "Bulgarian",
    4: "Chinese (Traditional)",
    5: "Chinese (Simplified)",
    6: "Czech",
    7: "Danish",
    8: "German",
    9: "Greek",
    10: "Spanish",
    11: "Finnish",
    12: "French",
    13: "Hebrew",
    14: "Hungarian",
    16: "Italian",
    17: "Japanese",
    18: "Korean",
    19: "Dutch",
    20: "Norwegian",
    21: "Polish",
    22: "Portuguese (Brazil)",
    24: "Romanian",
    25: "Russian",
    26: "Croatian",
    27: "Slovak",
    29: "Swedish",
    30: "Thai",
    31: "Turkish",
    32: "Urdu",
    33: "Indonesian",
    34: "Ukrainian",
    36: "Slovenian",
    37: "Estonian",
    38: "Latvian",
    39: "Lithuanian",
    41: "Farsi",
    42: "Vietnamese",
    44: "Armenian",
    47: "Georgian",
    54: "Afrikaans",
    55: "Bengali",
    56: "Gujarati",
    57: "Kannada",
    58: "Malayalam",
    59: "Oriya",
    60: "Tamil",
    61: "Telugu",
    62: "Sinhala",
  };
  const label = names[primary] ?? `Language 0x${primary.toString(16)}`;
  if (sub === 0) return label;
  const region: Record<number, string> = {
    1: "Argentina",
    2: "Bolivia",
    3: "Chile",
    4: "Colombia",
    5: "Costa Rica",
    6: "Dominican Republic",
    7: "Ecuador",
    8: "El Salvador",
    9: "Guatemala",
    10: "Honduras",
    11: "Mexico",
    12: "Nicaragua",
    13: "Panama",
    14: "Paraguay",
    15: "Peru",
    16: "Puerto Rico",
    17: "Uruguay",
    18: "Venezuela",
  };
  return region[sub] ? `${label} (${region[sub]})` : label;
}

function macLanguageName(languageId: number): string {
  return MAC_LANGUAGE_NAMES[languageId] ?? `Language ${languageId}`;
}

export function parseName(bytes: Uint8Array): NameRecord[] {
  const reader = new BinaryReader(bytes);
  const format = reader.uint16();
  const count = reader.uint16();
  const stringOffset = reader.uint16();
  if (format === 1) {
    // Name IDs 25 6 259 260 261 are stored as u16 when format is 1.
    reader.uint16(); // langTagCount
  }

  const records: NameRecord[] = [];
  for (let i = 0; i < count; i++) {
    const platformId = reader.uint16();
    const encodingId = reader.uint16();
    const languageId = reader.uint16();
    const nameId = reader.uint16();
    const length = reader.uint16();
    const offset = reader.uint16();
    if (format === 1) reader.skip(2); // nameLength / nameOffset are u32 pairs

    const start = stringOffset + offset;
    if (start + length > bytes.byteLength) continue;

    let value = "";
    try {
      const stringReader = new BinaryReader(bytes).seek(start);
      value = decodeNameString(
        stringReader,
        length,
        platformId === 3 || platformId === 0,
      );
    } catch {
      continue;
    }

    records.push({
      nameId,
      label: NAME_ID_LABELS[nameId] ?? `Name ID ${nameId}`,
      platformId,
      platform: platformLabel(platformId),
      encodingId,
      languageId,
      language:
        platformId === 1
          ? macLanguageName(languageId)
          : platformId === 3
            ? windowsLanguageName(languageId)
            : `Language 0x${languageId.toString(16)}`,
      value,
    });
  }

  return records;
}

function decodeNameString(
  reader: BinaryReader,
  length: number,
  wide: boolean,
): string {
  if (wide) {
    return reader.utf16be(Math.floor(length / 2));
  }
  // Macintosh strings are byte based; treat as Latin-1.
  let out = "";
  for (const byte of reader.readBytes(length)) out += String.fromCharCode(byte);
  return out;
}
