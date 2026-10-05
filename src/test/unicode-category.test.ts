import { describe, expect, it } from "vitest";
import { generalCategory } from "@/lib/font/unicode-category";

describe("generalCategory", () => {
  it("classifies the characters a designer browses by", () => {
    const cases: [number, string][] = [
      [0x41, "letter"], // A
      [0x61, "letter"], // a
      [0x00e9, "letter"], // e-acute
      [0x4e00, "letter"], // CJK ideograph
      [0x3042, "letter"], // Hiragana
      [0x0627, "letter"], // Arabic alef
      [0x05d0, "letter"], // Hebrew alef
      [0x30, "number"], // 0
      [0x0660, "number"], // Arabic-Indic zero
      [0x002e, "punctuation"], // full stop
      [0x002c, "punctuation"], // comma
      [0x2014, "punctuation"], // em dash
      [0x00a9, "symbol"], // copyright
      [0x20ac, "symbol"], // euro
      [0x2192, "symbol"], // rightwards arrow
      [0x0040, "punctuation"], // commercial at is Po in Unicode
      [0x0301, "mark"], // combining acute
      [0x0654, "mark"], // Arabic hamza above
      [0x0020, "separator"], // space
      [0x00a0, "separator"], // no-break space
      [0x0009, "control"], // tab
      [0x00ad, "control"], // soft hyphen
      [0x200b, "control"], // zero width space
    ];

    for (const [codepoint, expected] of cases) {
      expect(
        generalCategory(codepoint),
        `U+${codepoint.toString(16).toUpperCase()}`,
      ).toBe(expected);
    }
  });

  it("returns unassigned for code points outside the table", () => {
    expect(generalCategory(0x0378)).toBe("unassigned"); // unassigned in Unicode
    expect(generalCategory(0xe000)).toBe("unassigned"); // private use
  });

  it("prefers the first matching range, so no entry is shadowed", () => {
    // Ranges are grouped by category rather than sorted, which means a later
    // entry must never claim a code point an earlier one already covers.
    // These three were previously wrong and silently shadowed.
    expect(generalCategory(0x02c6)).toBe("letter"); // modifier letter
    expect(generalCategory(0x2044)).toBe("symbol"); // fraction slash
    expect(generalCategory(0x2052)).toBe("symbol"); // commercial minus
  });
});
