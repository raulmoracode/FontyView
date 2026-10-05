/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { analyzeFontFile } from "@/lib/font/analyze";
import {
  buildExport,
  DEFAULT_SECTIONS,
  EXPORT_SECTIONS,
  exportFileName,
  serializeExport,
} from "@/lib/font/export";
import { buildTrueTypeFont } from "./fixtures/truetype-builder";

async function load(options?: {
  gsub?: boolean;
  kern?: boolean;
  variable?: boolean;
}) {
  return analyzeFontFile(new File([buildTrueTypeFont(options)], "Fixture.ttf"));
}

/** Every object key anywhere in the report. */
function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysOf(entry, found);
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      found.add(key);
      keysOf(entry, found);
    }
  }
  return found;
}

describe("JSON export", () => {
  it("includes only the sections that were asked for", async () => {
    const loaded = await load();

    const metadataOnly = buildExport(loaded, ["metadata"]);
    expect(Object.keys(metadataOnly)).toEqual([
      "generator",
      "exportedAt",
      "file",
      "metadata",
    ]);

    const everything = buildExport(loaded, [...EXPORT_SECTIONS]);
    for (const section of EXPORT_SECTIONS) {
      expect(everything).toHaveProperty(section);
    }
  });

  it("never carries the font's own bytes", async () => {
    const loaded = await load({ gsub: true, kern: true, variable: true });
    const report = buildExport(loaded, [...EXPORT_SECTIONS]);
    const keys = keysOf(report);

    // `loca` is a Uint32Array and the raw font is a Uint8Array: either would
    // serialise into something large and meaningless.
    expect(keys.has("bytes")).toBe(false);
    expect(keys.has("loca")).toBe(false);
    expect(keys.has("rawCache")).toBe(false);

    const text = serializeExport(report, false);
    expect(Buffer.from(text).length).toBeLessThan(
      loaded.bytes.byteLength * 100,
    );
  });

  it("writes the cmap mapping as sorted pairs, not a Map", async () => {
    const loaded = await load();
    const report = buildExport(loaded, ["unicode"]);
    const mapping = report.unicode?.mapping as [number, number][];

    expect(mapping.length).toBeGreaterThan(0);
    expect(mapping.map(([codepoint]) => codepoint)).toEqual(
      [...mapping.map(([codepoint]) => codepoint)].sort((a, b) => a - b),
    );
    // The fixture maps A, B and e-acute.
    expect(mapping).toEqual([
      [0x41, 1],
      [0x42, 2],
      [0xe9, 4],
    ]);
  });

  it("orders ligatures so the same font exports the same file", async () => {
    const loaded = await load({ gsub: true });
    const first = buildExport(loaded, ["ligatures"]);
    const second = buildExport(loaded, ["ligatures"]);

    // Only the timestamp may differ between two builds.
    delete first.exportedAt;
    delete second.exportedAt;
    expect(first).toEqual(second);

    const items = first.ligatures?.items as {
      glyph: number;
      components: number[];
    }[];
    expect(items.length).toBe(6);
    expect(items[0]).toEqual({ glyph: 3, components: [1, 2], lookup: 0 });
  });

  it("reports an absent GSUB instead of inventing ligatures", async () => {
    const loaded = await load();
    const report = buildExport(loaded, ["ligatures"]);

    expect(report.ligatures).toEqual({ present: false, items: [] });
  });

  it("round-trips through JSON", async () => {
    const loaded = await load({ gsub: true });
    const text = serializeExport(buildExport(loaded, DEFAULT_SECTIONS), false);
    const parsed = JSON.parse(text) as { generator: string };

    expect(parsed.generator).toBe("FontyView");
    expect(JSON.parse(serializeExport(buildExport(loaded, []), true))).toEqual({
      generator: "FontyView",
      exportedAt: expect.any(String),
      file: expect.any(Object),
    });
  });

  it("pretty printing only changes the whitespace", async () => {
    const loaded = await load();
    const report = buildExport(loaded, ["metadata"]);

    expect(JSON.parse(serializeExport(report, true))).toEqual(
      JSON.parse(serializeExport(report, false)),
    );
    expect(serializeExport(report, true).length).toBeGreaterThan(
      serializeExport(report, false).length,
    );
  });

  it("names the file after the font and keeps it usable", async () => {
    const loaded = await load();

    // The fixture's PostScript name, with no extension and no path characters.
    expect(exportFileName(loaded)).toBe(
      "Fixture-TrueType-Regular-analysis.json",
    );
    expect(exportFileName(loaded)).not.toMatch(/[/\\]/);
  });
});
