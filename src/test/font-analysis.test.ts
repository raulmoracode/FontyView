/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { analyzeFontFile } from "@/lib/font/analyze";
import { FontAnalysisError } from "@/lib/font/errors";
import { buildTrueTypeFont } from "./fixtures/truetype-builder";

function fontFile(name: string, bytes: Uint8Array<ArrayBuffer>): File {
  return new File([bytes], name);
}

describe("analyzeFontFile", () => {
  it("reads metadata, metrics and character coverage from the binary", async () => {
    const loaded = await analyzeFontFile(
      fontFile("Fixture.ttf", buildTrueTypeFont()),
    );
    const { analysis } = loaded;

    expect(analysis.file.format).toBe("ttf");
    expect(analysis.file.fileName).toBe("Fixture.ttf");
    expect(analysis.outlineFormat).toBe("truetype");
    expect(analysis.unitsPerEm).toBe(1000);

    expect(analysis.metadata.familyName).toBe("Fixture TrueType");
    expect(analysis.metadata.subfamilyName).toBe("Regular");
    expect(analysis.metadata.version).toBe("Version 1.000");

    expect(analysis.statistics.glyphCount).toBe(5);
    // A, B and e-acute are the only mapped characters.
    expect(analysis.statistics.unicodePoints).toBe(3);

    const advances = loaded.structure.metrics.map((m) => m.advanceWidth);
    // `.notdef` in this fixture is empty and has a zero advance.
    expect(advances).toEqual([0, 600, 560, 1160, 700]);
    expect(analysis.statistics.minimumAdvance).toBe(0);
    expect(analysis.statistics.maximumAdvance).toBe(1160);
    expect(analysis.statistics.averageAdvance).toBe(604);

    expect(analysis.scripts.map((s) => s.script)).toEqual(["Latin"]);
  });

  it("reports every table the font actually contains", async () => {
    const { analysis } = await analyzeFontFile(
      fontFile("Fixture.ttf", buildTrueTypeFont()),
    );
    const tags = analysis.tables.map((table) => table.tag);

    expect(tags).toEqual([
      "cmap",
      "glyf",
      "head",
      "hhea",
      "hmtx",
      "loca",
      "maxp",
      "name",
      "post",
    ]);
    // Absent tables are never invented.
    expect(tags).not.toContain("OS/2");
    expect(analysis.tables.every((table) => table.length > 0)).toBe(true);
    expect(analysis.tables.find((t) => t.tag === "glyf")?.description).toBe(
      "Glyph outlines",
    );
  });

  it("emits a css family name that is unique per analysis", async () => {
    const first = await analyzeFontFile(fontFile("a.ttf", buildTrueTypeFont()));
    const second = await analyzeFontFile(
      fontFile("a.ttf", buildTrueTypeFont()),
    );
    expect(first.analysis.cssFamilyName).not.toBe(
      second.analysis.cssFamilyName,
    );
  });

  it("rejects a file that is not a font", async () => {
    const junk = new TextEncoder().encode("not a font at all, just text");
    await expect(
      analyzeFontFile(fontFile("notes.txt", junk)),
    ).rejects.toBeInstanceOf(FontAnalysisError);
  });

  it("rejects an empty file", async () => {
    await expect(
      analyzeFontFile(fontFile("empty.ttf", new Uint8Array(0))),
    ).rejects.toBeInstanceOf(FontAnalysisError);
  });
});
