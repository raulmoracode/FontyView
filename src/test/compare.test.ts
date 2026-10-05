/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { analyzeFontFile } from "@/lib/font/analyze";
import {
  compareFonts,
  comparisonGroups,
  formatComparisonValue,
  rowsInGroup,
} from "@/lib/font/compare";
import { buildTrueTypeFont } from "./fixtures/truetype-builder";

type Options = Parameters<typeof buildTrueTypeFont>[0];

async function load(options?: Options) {
  return analyzeFontFile(
    new File([buildTrueTypeFont(options)], "FontyView.ttf"),
  );
}

describe("font comparison", () => {
  it("reports nothing differing between a font and itself", async () => {
    const font = await load({ gsub: true, kern: true, variable: true });
    const comparison = compareFonts(font, font);

    expect(comparison.differing).toBe(0);
    expect(comparison.rows.every((row) => !row.differs)).toBe(true);
    expect(comparison.tables).toEqual([]);
    expect(comparison.features.onlyLeft).toEqual([]);
    expect(comparison.features.onlyRight).toEqual([]);
    expect(comparison.features.shared).toEqual(["kern", "liga", "ss01"]);
  });

  it("marks only the values that disagree", async () => {
    const rich = await load({ gsub: true, kern: true, variable: true });
    const plain = await load();
    const comparison = compareFonts(rich, plain);

    const differing = comparison.rows
      .filter((row) => row.differs)
      .map((row) => row.label);
    expect(differing).toEqual([
      "File size",
      "Tables",
      "Variation axes",
      "Kerning pairs",
      "Ligatures",
    ]);

    // The metrics both fonts share stay equal.
    const units = comparison.rows.find((row) => row.label === "unitsPerEm");
    expect(units?.left).toBe(1000);
    expect(units?.right).toBe(1000);
    expect(units?.differs).toBe(false);
  });

  it("keeps missing values as missing rather than zero", async () => {
    const font = await load();
    const comparison = compareFonts(font, font);
    const capHeight = comparison.rows.find((row) => row.label === "Cap height");

    expect(capHeight?.left).toBeNull();
    expect(capHeight?.right).toBeNull();
    expect(capHeight?.differs).toBe(false);
  });

  it("splits feature tags by which font applies them", async () => {
    const rich = await load({ gsub: true });
    const plain = await load();
    const comparison = compareFonts(rich, plain);

    expect(comparison.features.onlyLeft).toEqual(["kern", "liga", "ss01"]);
    expect(comparison.features.onlyRight).toEqual([]);
    expect(comparison.features.shared).toEqual([]);
  });

  it("separates tables only one font has", async () => {
    const rich = await load({ variable: true });
    const plain = await load();
    const comparison = compareFonts(rich, plain);

    const onlyLeft = comparison.tables
      .filter((table) => table.kind === "only-left")
      .map((table) => table.tag);
    expect(onlyLeft).toContain("fvar");

    expect(comparison.tables.some((table) => table.kind === "only-right")).toBe(
      false,
    );
  });

  it("groups rows for display", async () => {
    const font = await load();
    const comparison = compareFonts(font, font);

    expect(comparisonGroups(comparison)).toEqual([
      "Identity",
      "Coverage",
      "Vertical metrics",
      "Horizontal metrics",
      "Classification",
      "Layout",
    ]);
    expect(
      rowsInGroup(comparison, "Vertical metrics").map((row) => row.label),
    ).toContain("unitsPerEm");
    expect(rowsInGroup(comparison, "Identity")).toHaveLength(7);
  });

  it("shows a delta against the other font's value", () => {
    expect(formatComparisonValue(1428, 760)).toBe("1,428 (+668)");
    expect(formatComparisonValue(760, 1428)).toBe("760 (-668)");
    expect(formatComparisonValue(1000, 1000)).toBe("1,000");
    expect(formatComparisonValue(null, 1000)).toBe("Not available");
    expect(formatComparisonValue("Regular", "Bold")).toBe("Regular");
  });
});
