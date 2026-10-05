/**
 * Unicode block and script reference data.
 *
 * Kept as an explicit table so block coverage and script detection are always
 * derived from the font's own cmap rather than from a hardcoded expectation.
 */

export type UnicodeBlock = {
  start: number;
  end: number;
  name: string;
  script?: string;
};

export const UNICODE_BLOCKS: UnicodeBlock[] = [
  { start: 0x0000, end: 0x007f, name: "Basic Latin", script: "Latin" },
  { start: 0x0080, end: 0x00ff, name: "Latin-1 Supplement", script: "Latin" },
  { start: 0x0100, end: 0x017f, name: "Latin Extended-A", script: "Latin" },
  { start: 0x0180, end: 0x024f, name: "Latin Extended-B", script: "Latin" },
  { start: 0x0250, end: 0x02af, name: "IPA Extensions", script: "Latin" },
  { start: 0x02b0, end: 0x02ff, name: "Spacing Modifier Letters" },
  { start: 0x0300, end: 0x036f, name: "Combining Diacritical Marks" },
  { start: 0x0370, end: 0x03ff, name: "Greek and Coptic", script: "Greek" },
  { start: 0x0400, end: 0x04ff, name: "Cyrillic", script: "Cyrillic" },
  {
    start: 0x0500,
    end: 0x052f,
    name: "Cyrillic Supplement",
    script: "Cyrillic",
  },
  { start: 0x0530, end: 0x058f, name: "Armenian", script: "Armenian" },
  { start: 0x0590, end: 0x05ff, name: "Hebrew", script: "Hebrew" },
  { start: 0x0600, end: 0x06ff, name: "Arabic", script: "Arabic" },
  { start: 0x0700, end: 0x074f, name: "Syriac", script: "Syriac" },
  { start: 0x0750, end: 0x077f, name: "Arabic Supplement", script: "Arabic" },
  { start: 0x0780, end: 0x07bf, name: "Thaana", script: "Thaana" },
  { start: 0x07c0, end: 0x07ff, name: "NKo", script: "NKo" },
  { start: 0x0800, end: 0x083f, name: "Samaritan", script: "Samaritan" },
  { start: 0x0900, end: 0x097f, name: "Devanagari", script: "Devanagari" },
  { start: 0x0980, end: 0x09ff, name: "Bengali", script: "Bengali" },
  { start: 0x0a00, end: 0x0a7f, name: "Gurmukhi", script: "Gurmukhi" },
  { start: 0x0a80, end: 0x0aff, name: "Gujarati", script: "Gujarati" },
  { start: 0x0b00, end: 0x0b7f, name: "Oriya", script: "Oriya" },
  { start: 0x0b80, end: 0x0bff, name: "Tamil", script: "Tamil" },
  { start: 0x0c00, end: 0x0c7f, name: "Telugu", script: "Telugu" },
  { start: 0x0c80, end: 0x0cff, name: "Kannada", script: "Kannada" },
  { start: 0x0d00, end: 0x0d7f, name: "Malayalam", script: "Malayalam" },
  { start: 0x0e00, end: 0x0e7f, name: "Thai", script: "Thai" },
  { start: 0x0e80, end: 0x0eff, name: "Lao", script: "Lao" },
  { start: 0x0f00, end: 0x0fff, name: "Tibetan", script: "Tibetan" },
  { start: 0x1000, end: 0x109f, name: "Myanmar", script: "Myanmar" },
  { start: 0x10a0, end: 0x10ff, name: "Georgian", script: "Georgian" },
  { start: 0x1100, end: 0x11ff, name: "Hangul Jamo", script: "Hangul" },
  { start: 0x1200, end: 0x139f, name: "Ethiopic", script: "Ethiopic" },
  { start: 0x13a0, end: 0x13ff, name: "Cherokee", script: "Cherokee" },
  {
    start: 0x1400,
    end: 0x167f,
    name: "Canadian Syllabics",
    script: "Canadian Syllabics",
  },
  { start: 0x1680, end: 0x169f, name: "Ogham" },
  { start: 0x16a0, end: 0x16ff, name: "Runic" },
  { start: 0x1700, end: 0x171f, name: "Tagalog" },
  { start: 0x1780, end: 0x17ff, name: "Khmer", script: "Khmer" },
  { start: 0x1800, end: 0x18af, name: "Mongolian", script: "Mongolian" },
  {
    start: 0x1e00,
    end: 0x1eff,
    name: "Latin Extended Additional",
    script: "Latin",
  },
  { start: 0x1f00, end: 0x1fff, name: "Greek Extended", script: "Greek" },
  { start: 0x2000, end: 0x206f, name: "General Punctuation" },
  { start: 0x2070, end: 0x209f, name: "Superscripts and Subscripts" },
  { start: 0x20a0, end: 0x20cf, name: "Currency Symbols" },
  {
    start: 0x20d0,
    end: 0x20ff,
    name: "Combining Diacritical Marks for Symbols",
  },
  { start: 0x2100, end: 0x214f, name: "Letterlike Symbols" },
  { start: 0x2150, end: 0x218f, name: "Number Forms" },
  { start: 0x2190, end: 0x21ff, name: "Arrows" },
  { start: 0x2200, end: 0x22ff, name: "Mathematical Operators" },
  { start: 0x2300, end: 0x23ff, name: "Miscellaneous Technical" },
  { start: 0x2400, end: 0x243f, name: "Control Pictures" },
  { start: 0x2440, end: 0x245f, name: "Optical Character Recognition" },
  { start: 0x2460, end: 0x24ff, name: "Enclosed Alphanumerics" },
  { start: 0x2500, end: 0x257f, name: "Box Drawing" },
  { start: 0x2580, end: 0x259f, name: "Block Elements" },
  { start: 0x25a0, end: 0x25ff, name: "Geometric Shapes" },
  { start: 0x2600, end: 0x26ff, name: "Miscellaneous Symbols" },
  { start: 0x2700, end: 0x27bf, name: "Dingbats" },
  { start: 0x27c0, end: 0x27ef, name: "Miscellaneous Mathematical Symbols-A" },
  { start: 0x27f0, end: 0x27ff, name: "Supplemental Arrows-A" },
  { start: 0x2800, end: 0x28ff, name: "Braille Patterns" },
  { start: 0x2900, end: 0x297f, name: "Supplemental Arrows-B" },
  { start: 0x2a00, end: 0x2aff, name: "Miscellaneous Mathematical Symbols-B" },
  { start: 0x2b00, end: 0x2bff, name: "Miscellaneous Symbols and Arrows" },
  { start: 0x2e80, end: 0x2eff, name: "CJK Radicals Supplement" },
  { start: 0x2f00, end: 0x2fdf, name: "Kangxi Radicals" },
  {
    start: 0x3000,
    end: 0x303f,
    name: "CJK Symbols and Punctuation",
    script: "Han",
  },
  { start: 0x3040, end: 0x309f, name: "Hiragana", script: "Hiragana" },
  { start: 0x30a0, end: 0x30ff, name: "Katakana", script: "Katakana" },
  { start: 0x3100, end: 0x312f, name: "Bopomofo" },
  {
    start: 0x3130,
    end: 0x318f,
    name: "Hangul Compatibility Jamo",
    script: "Hangul",
  },
  {
    start: 0x31f0,
    end: 0x31ff,
    name: "Katakana Phonetic Extensions",
    script: "Katakana",
  },
  { start: 0x3200, end: 0x32ff, name: "Enclosed CJK Letters and Months" },
  { start: 0x3300, end: 0x33ff, name: "CJK Compatibility" },
  {
    start: 0x3400,
    end: 0x4dbf,
    name: "CJK Unified Ideographs Extension A",
    script: "Han",
  },
  { start: 0x4e00, end: 0x9fff, name: "CJK Unified Ideographs", script: "Han" },
  { start: 0xa000, end: 0xa48f, name: "Yi Syllables" },
  { start: 0xa720, end: 0xa7ff, name: "Latin Extended-D", script: "Latin" },
  { start: 0xac00, end: 0xd7af, name: "Hangul Syllables", script: "Hangul" },
  {
    start: 0xf900,
    end: 0xfaff,
    name: "CJK Compatibility Ideographs",
    script: "Han",
  },
  { start: 0xfb00, end: 0xfb4f, name: "Alphabetic Presentation Forms" },
  {
    start: 0xfb50,
    end: 0xfdff,
    name: "Arabic Presentation Forms-A",
    script: "Arabic",
  },
  { start: 0xfe00, end: 0xfe0f, name: "Variation Selectors" },
  { start: 0xfe20, end: 0xfe2f, name: "Combining Half Marks" },
  {
    start: 0xfe70,
    end: 0xfeff,
    name: "Arabic Presentation Forms-B",
    script: "Arabic",
  },
  { start: 0xff00, end: 0xffef, name: "Halfwidth and Fullwidth Forms" },
  { start: 0xfff0, end: 0xffff, name: "Specials" },
  { start: 0x10000, end: 0x1007f, name: "Linear B Syllabary" },
  { start: 0x10140, end: 0x1018f, name: "Ancient Greek Numbers" },
  { start: 0x10330, end: 0x1034f, name: "Gothic" },
  { start: 0x1d000, end: 0x1d0ff, name: "Byzantine Musical Symbols" },
  { start: 0x1d100, end: 0x1d1ff, name: "Musical Symbols" },
  { start: 0x1d400, end: 0x1d7ff, name: "Mathematical Alphanumeric Symbols" },
  {
    start: 0x1ee00,
    end: 0x1eeff,
    name: "Arabic Mathematical Alphabetic Symbols",
    script: "Arabic",
  },
  {
    start: 0x1f300,
    end: 0x1f5ff,
    name: "Miscellaneous Symbols and Pictographs",
  },
  { start: 0x1f600, end: 0x1f64f, name: "Emoticons" },
  { start: 0x1f680, end: 0x1f6ff, name: "Transport and Map Symbols" },
  {
    start: 0x1f900,
    end: 0x1f9ff,
    name: "Supplemental Symbols and Pictographs",
  },
  {
    start: 0x20000,
    end: 0x2a6df,
    name: "CJK Unified Ideographs Extension B",
    script: "Han",
  },
  {
    start: 0x2a700,
    end: 0x2b73f,
    name: "CJK Unified Ideographs Extension C",
    script: "Han",
  },
  {
    start: 0x2b740,
    end: 0x2b81f,
    name: "CJK Unified Ideographs Extension D",
    script: "Han",
  },
  {
    start: 0x2b820,
    end: 0x2ceaf,
    name: "CJK Unified Ideographs Extension E",
    script: "Han",
  },
  {
    start: 0x2f800,
    end: 0x2fa1f,
    name: "CJK Compatibility Ideographs Supplement",
    script: "Han",
  },
  {
    start: 0x30000,
    end: 0x3134f,
    name: "CJK Unified Ideographs Extension G",
    script: "Han",
  },
  { start: 0xe0000, end: 0xe007f, name: "Tags" },
  { start: 0xf0000, end: 0xffffd, name: "Supplementary Private Use Area-A" },
  { start: 0x100000, end: 0x10fffd, name: "Supplementary Private Use Area-B" },
];

/** Scripts probed for coverage, independent of which blocks a font uses. */
export const KNOWN_SCRIPTS = [
  "Latin",
  "Greek",
  "Cyrillic",
  "Armenian",
  "Hebrew",
  "Arabic",
  "Syriac",
  "Thaana",
  "Devanagari",
  "Bengali",
  "Gurmukhi",
  "Gujarati",
  "Oriya",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Thai",
  "Lao",
  "Tibetan",
  "Myanmar",
  "Georgian",
  "Hangul",
  "Ethiopic",
  "Cherokee",
  "Canadian Syllabics",
  "Khmer",
  "Mongolian",
  "Hiragana",
  "Katakana",
  "Han",
];

export function blockForCodepoint(codepoint: number): UnicodeBlock | null {
  let low = 0;
  let high = UNICODE_BLOCKS.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const block = UNICODE_BLOCKS[mid];
    if (codepoint < block.start) high = mid - 1;
    else if (codepoint > block.end) low = mid + 1;
    else return block;
  }
  return null;
}

export function formatCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}
