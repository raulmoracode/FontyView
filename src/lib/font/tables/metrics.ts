import { BinaryReader } from "../binary-reader";
import type { Maybe } from "../types";
import type { NameRecord } from "./core";
import { NAME_ID_LABELS } from "./core";

/** A single glyph's horizontal metrics. */
export type GlyphMetric = {
  advanceWidth: number;
  leftSideBearing: number;
};

export type PostTable = {
  version: number;
  italicAngle: number;
  underlinePosition: Maybe<number>;
  underlineThickness: Maybe<number>;
  isFixedPitch: boolean;
  minMemType42: Maybe<number>;
  maxMemType42: Maybe<number>;
  minMemType1: Maybe<number>;
  maxMemType1: Maybe<number>;
  glyphNames: string[] | null;
};

export function parsePost(bytes: Uint8Array, numGlyphs: number): PostTable {
  const reader = new BinaryReader(bytes);
  const version = reader.fixed();
  const italicAngle = reader.fixed();
  const underlinePosition = reader.int16();
  const underlineThickness = reader.int16();
  const isFixedPitch = reader.uint32() !== 0;
  const minMemType42 = reader.uint32();
  const maxMemType42 = reader.uint32();
  const minMemType1 = reader.uint32();
  const maxMemType1 = reader.uint32();

  let glyphNames: string[] | null = null;
  if (version === 2) {
    glyphNames = parsePostGlyphNames(bytes, reader, numGlyphs);
  }

  return {
    version,
    italicAngle,
    underlinePosition,
    underlineThickness,
    isFixedPitch,
    minMemType42,
    maxMemType42,
    minMemType1,
    maxMemType1,
    glyphNames,
  };
}

const MAC_GLYPH_NAMES = [
  ".notdef",
  ".null",
  "nonmarkingreturn",
  "space",
  "exclam",
  "quotedbl",
  "numbersign",
  "dollar",
  "percent",
  "ampersand",
  "quotesingle",
  "parenleft",
  "parenright",
  "asterisk",
  "plus",
  "comma",
  "hyphen",
  "period",
  "slash",
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "colon",
  "semicolon",
  "less",
  "equal",
  "greater",
  "question",
  "at",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "bracketleft",
  "backslash",
  "bracketright",
  "asciicircum",
  "underscore",
  "grave",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "braceleft",
  "bar",
  "braceright",
  "asciitilde",
  "Adieresis",
  "Aring",
  "Ccedilla",
  "Eacute",
  "Ntilde",
  "Odieresis",
  "Udieresis",
  "aacute",
  "agrave",
  "acircumflex",
  "adieresis",
  "atilde",
  "aring",
  "ccedilla",
  "eacute",
  "egrave",
  "ecircumflex",
  "edieresis",
  "iacute",
  "igrave",
  "icircumflex",
  "idieresis",
  "ntilde",
  "oacute",
  "ograve",
  "ocircumflex",
  "odieresis",
  "otilde",
  "uacute",
  "ugrave",
  "ucircumflex",
  "udieresis",
  "dagger",
  "degree",
  "cent",
  "sterling",
  "section",
  "bullet",
  "paragraph",
  "germandbls",
  "registered",
  "copyright",
  "trademark",
  "acute",
  "dieresis",
  "notequal",
  "AE",
  "Oslash",
  "infinity",
  "plusminus",
  "lessequal",
  "greaterequal",
  "yen",
  "mu",
  "partialdiff",
  "summation",
  "product",
  "pi",
  "integral",
  "ordfeminine",
  "ordmasculine",
  "Omega",
  "ae",
  "oslash",
  "questiondown",
  "exclamdown",
  "logicalnot",
  "radical",
  "florin",
  "approxequal",
  "Delta",
  "guillemotleft",
  "guillemotright",
  "ellipsis",
  "nonbreakingspace",
  "Agrave",
  "Atilde",
  "Otilde",
  "OE",
  "oe",
  "endash",
  "emdash",
  "quotedblleft",
  "quotedblright",
  "quoteleft",
  "quoteright",
  "divide",
  "lozenge",
  "ydieresis",
  "Ydieresis",
  "fraction",
  "currency",
  "guilsinglleft",
  "guilsinglright",
  "fi",
  "fl",
  "daggerdbl",
  "periodcentered",
  "quotesinglbase",
  "quotedblbase",
  "perthousand",
  "Acircumflex",
  "Ecircumflex",
  "Aacute",
  "Edieresis",
  "Egrave",
  "Iacute",
  "Icircumflex",
  "Idieresis",
  "Igrave",
  "Oacute",
  "Ocircumflex",
  "apple",
  "Ograve",
  "Uacute",
  "Ucircumflex",
  "Ugrave",
  "dotlessi",
  "circumflex",
  "tilde",
  "macron",
  "breve",
  "dotaccent",
  "ring",
  "cedilla",
  "hungarumlaut",
  "ogonek",
  "caron",
  "Lslash",
  "lslash",
  "Scaron",
  "scaron",
  "Zcaron",
  "zcaron",
  "brokenbar",
  "Eth",
  "eth",
  "Yacute",
  "yacute",
  "Thorn",
  "thorn",
  "minus",
  "multiply",
  "onesuperior",
  "twosuperior",
  "threesuperior",
  "onehalf",
  "onequarter",
  "threequarters",
  "franc",
  "Gbreve",
  "gbreve",
  "Idotaccent",
  "Scedilla",
  "scedilla",
  "Cacute",
  "cacute",
  "Ccaron",
  "ccaron",
  "dcroat",
];

function parsePostGlyphNames(
  bytes: Uint8Array,
  reader: BinaryReader,
  numGlyphs: number,
): string[] | null {
  try {
    const numGlyphsInPost = reader.uint16();
    const indices: number[] = [];
    for (let i = 0; i < numGlyphsInPost; i++) indices.push(reader.uint16());

    const customNames: string[] = [];
    while (reader.position < bytes.byteLength) {
      const length = bytes[reader.position];
      if (length === undefined) break;
      reader.skip(1);
      let name = "";
      for (let i = 0; i < length; i++) {
        name += String.fromCharCode(reader.uint8());
      }
      customNames.push(name);
      if (customNames.length > 20_000) break;
    }

    const names: string[] = [];
    for (let glyphId = 0; glyphId < numGlyphs; glyphId++) {
      const index = indices[glyphId];
      if (index === undefined) {
        names.push("");
        continue;
      }
      if (index < 258) names.push(MAC_GLYPH_NAMES[index] ?? `mac${index}`);
      else names.push(customNames[index - 258] ?? `post${index}`);
    }
    return names;
  } catch {
    return null;
  }
}

/**
 * Reads `hmtx`, expanding the last advance width across the trailing glyphs
 * as the specification requires.
 */
export function parseHmtx(
  bytes: Uint8Array,
  numberOfHMetrics: number,
  numGlyphs: number,
): GlyphMetric[] {
  const reader = new BinaryReader(bytes);
  const metrics: GlyphMetric[] = [];
  let lastAdvance = 0;

  for (let i = 0; i < numGlyphs; i++) {
    if (i < numberOfHMetrics) {
      lastAdvance = reader.uint16();
    }
    const leftSideBearing = reader.int16();
    metrics.push({ advanceWidth: lastAdvance, leftSideBearing });
  }

  return metrics;
}

/** A resolved `name` value, or an explicit "missing" marker. */
export function nameValue(
  names: Map<number, string>,
  nameId: number,
): string | null {
  const value = names.get(nameId);
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function nameLabel(nameId: number): string {
  return NAME_ID_LABELS[nameId] ?? `Name ID ${nameId}`;
}

export type { NameRecord };
