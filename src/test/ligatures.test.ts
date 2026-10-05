/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { analyzeFontFile } from "@/lib/font/analyze";
import { buildTrueTypeFont } from "./fixtures/truetype-builder";

async function load(options?: { gsub?: boolean; kern?: boolean }) {
  const loaded = await analyzeFontFile(
    new File([buildTrueTypeFont(options)], "FontyView.ttf"),
  );
  return loaded;
}

function gsubOf(loaded: Awaited<ReturnType<typeof load>>) {
  return loaded.structure.layout.find((table) => table.kind === "GSUB");
}

describe("ligature substitutions", () => {
  it("reads every ligature a subtable can build", async () => {
    const gsub = gsubOf(await load({ gsub: true }));

    expect(gsub).toBeDefined();
    // The fixture builds three ligatures across two ligature sets, and the
    // extension lookup repeats the same subtable.
    expect(gsub?.ligatures).toEqual([
      { glyphId: 3, components: [1, 2], lookupIndex: 0 },
      { glyphId: 4, components: [1, 1, 2], lookupIndex: 0 },
      { glyphId: 4, components: [2, 1], lookupIndex: 0 },
      { glyphId: 3, components: [1, 2], lookupIndex: 3 },
      { glyphId: 4, components: [1, 1, 2], lookupIndex: 3 },
      { glyphId: 4, components: [2, 1], lookupIndex: 3 },
    ]);
  });

  it("takes the first component from the coverage table", async () => {
    const gsub = gsubOf(await load({ gsub: true }));

    // The second set starts at glyph 2, so that is its first component rather
    // than the glyph 1 every set would otherwise inherit.
    const fromSecondSet = gsub?.ligatures.find(
      (ligature) => ligature.components[0] === 2,
    );
    expect(fromSecondSet?.components).toEqual([2, 1]);
  });

  it("reads ligatures behind an extension lookup", async () => {
    const gsub = gsubOf(await load({ gsub: true }));

    const extension = gsub?.lookups[3];
    expect(extension?.isExtension).toBe(true);

    // The extension wraps the same subtable, so its ligatures are reported
    // again, attributed to the lookup that actually holds them.
    expect(
      gsub?.ligatures.filter((ligature) => ligature.lookupIndex === 3),
    ).toHaveLength(3);
  });

  it("does not mistake GSUB contextual substitution for an extension", async () => {
    const gsub = gsubOf(await load({ gsub: true }));

    // Lookup type 9 is contextual substitution in GSUB and extension in GPOS.
    expect(gsub?.lookups[1].lookupType).toBe(9);
    expect(gsub?.lookups[1].isExtension).toBe(false);
  });

  it("reports no ligatures for a font without GSUB", async () => {
    const loaded = await load({ kern: true });

    expect(loaded.structure.layout.some((table) => table.kind === "GSUB")).toBe(
      false,
    );
  });

  it("flags only the type 7 lookups as extensions", async () => {
    const gsub = gsubOf(await load({ gsub: true }));

    expect(gsub?.lookups.map((lookup) => lookup.isExtension)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});
