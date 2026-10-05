/// <reference types="node" />

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { decompress, initSync } from "brotli-dec-wasm/web";
import { parse } from "opentype.js";
import { describe, expect, it } from "vitest";
import {
  buildSfnt,
  decodeWoff,
  extractFromCollection,
  readContainerInfo,
  readOutlineFormat,
  readSfntDirectory,
  type SfntTableRecord,
} from "../lib/font/container";
import type { FontAnalysisError } from "../lib/font/errors";
import { decodeWoff2 } from "../lib/font/woff2";
import { buildTrueTypeFont } from "./fixtures/truetype-builder";

const require = createRequire(import.meta.url);
const compress = require("wawoff2").compress as (
  input: Uint8Array,
) => Promise<Uint8Array>;

// The Brotli WASM asset is fetched over HTTP in the browser, so tests point the
// decoder straight at the module on disk instead.
initSync({
  module: readFileSync(require.resolve("brotli-dec-wasm/web/bg.wasm")),
});

let cachedTtf: Uint8Array | null = null;

/** A spec-valid TrueType font with `glyf` outlines, built in memory. */
function trueTypeFont(): Uint8Array {
  cachedTtf ??= buildTrueTypeFont();
  return cachedTtf;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function tableMap(bytes: Uint8Array): Map<string, Uint8Array> {
  const { tables } = readSfntDirectory(bytes);
  const out = new Map<string, Uint8Array>();
  for (const table of tables) {
    out.set(
      table.tag,
      bytes.subarray(table.offset, table.offset + table.length),
    );
  }
  return out;
}

function bytesOf(map: Map<string, Uint8Array>, tag: string): number[] {
  return [...(map.get(tag) ?? [])];
}

describe("container sniffing", () => {
  it("recognises a TrueType sfnt", () => {
    const info = readContainerInfo(trueTypeFont());
    expect(info.format).toBe("ttf");
    expect(info.label).toBe("TrueType");
    expect(readOutlineFormat(readSfntDirectory(trueTypeFont()).tables)).toBe(
      "truetype",
    );
  });

  it("rejects an empty file", () => {
    try {
      readContainerInfo(new Uint8Array(0));
      throw new Error("expected a failure");
    } catch (error) {
      expect((error as FontAnalysisError).reason).toBe("empty-file");
    }
  });

  it("rejects a file that is not a font", () => {
    const text = new TextEncoder().encode("this is plainly not a font file");
    try {
      readContainerInfo(text);
      throw new Error("expected a failure");
    } catch (error) {
      expect((error as FontAnalysisError).reason).toBe("unsupported-format");
    }
  });

  it("rejects a file too small to hold a signature", () => {
    try {
      readContainerInfo(new Uint8Array([0, 1, 0]));
      throw new Error("expected a failure");
    } catch (error) {
      expect((error as FontAnalysisError).reason).toBe("not-a-font");
    }
  });
});

describe("sfnt directory", () => {
  it("reads the real table list", () => {
    const { flavor, tables } = readSfntDirectory(trueTypeFont());
    expect(flavor).toBe(0x0001_0000);

    const tags = tables.map((table) => table.tag);
    for (const required of [
      "cmap",
      "glyf",
      "head",
      "hhea",
      "hmtx",
      "loca",
      "maxp",
      "name",
    ]) {
      expect(tags).toContain(required);
    }
    expect(tags).toEqual([...tags].sort());
  });

  it("round-trips through buildSfnt", () => {
    const original = tableMap(trueTypeFont());
    const rebuilt = new Uint8Array(
      buildSfnt(
        0x0001_0000,
        [...original].map(([tag, data]) => ({ tag, data })),
      ),
    );
    const result = tableMap(rebuilt);

    expect([...result.keys()]).toEqual([...original.keys()]);
    for (const [tag, data] of original) {
      expect(bytesOf(result, tag)).toEqual([...data]);
    }
  });
});

describe("collections", () => {
  it("extracts the first font of a TTC", () => {
    const source = trueTypeFont();
    const { tables } = readSfntDirectory(source);
    const directoryLength = 12 + tables.length * 16;
    const out = new Uint8Array(16 + directoryLength + source.byteLength);
    const view = new DataView(out.buffer);

    view.setUint32(0, 0x7474_6366);
    view.setUint32(4, 0x0001_0000);
    view.setUint32(8, 1);
    view.setUint32(12, 16);

    out.set(source.subarray(0, directoryLength), 16);
    const tableBase = 16 + directoryLength;
    tables.forEach((table, index) => {
      const entry = 16 + 12 + index * 16;
      for (let i = 0; i < 4; i++) out[entry + i] = table.tag.charCodeAt(i);
      view.setUint32(entry + 8, tableBase + table.offset);
      view.setUint32(entry + 12, table.length);
    });
    out.set(source, tableBase);

    const info = readContainerInfo(out);
    expect(info.format).toBe("ttc");
    expect(info.fontCount).toBe(1);

    const extracted = new Uint8Array(extractFromCollection(out, 0));
    expect(bytesOf(tableMap(extracted), "glyf")).toEqual(
      bytesOf(tableMap(source), "glyf"),
    );
  });
});

describe("woff", () => {
  /** A WOFF container with uncompressed table payloads, which the spec allows. */
  function packWoff(): Uint8Array {
    const original = tableMap(trueTypeFont());
    const entries: SfntTableRecord[] = [...original].map(([tag, data]) => ({
      tag,
      checksum: 0,
      offset: 0,
      length: data.byteLength,
    }));

    const header = 44 + entries.length * 20;
    let cursor = header;
    for (const entry of entries) {
      entry.offset = cursor;
      cursor += entry.length + ((4 - (entry.length % 4)) % 4);
    }

    const out = new Uint8Array(cursor);
    const view = new DataView(out.buffer);
    out.set([0x77, 0x4f, 0x46, 0x46], 0);
    view.setUint32(4, 0x0001_0000);
    view.setUint32(8, out.byteLength);
    view.setUint16(12, entries.length);
    view.setUint32(16, out.byteLength);

    entries.forEach((entry, index) => {
      const at = 44 + index * 20;
      for (let i = 0; i < 4; i++) out[at + i] = entry.tag.charCodeAt(i);
      view.setUint32(at + 4, entry.offset);
      view.setUint32(at + 8, entry.length);
      view.setUint32(at + 12, entry.length);
      const payload = original.get(entry.tag);
      if (payload) out.set(payload, entry.offset);
    });

    return out;
  }

  it("detects the container", () => {
    const info = readContainerInfo(packWoff());
    expect(info.format).toBe("woff");
    expect(info.label).toBe("WOFF");
    expect(info.flavor).toBe(0x0001_0000);
  });

  it("unpacks to an equivalent sfnt", async () => {
    const result = tableMap(new Uint8Array(await decodeWoff(packWoff())));
    const original = tableMap(trueTypeFont());

    expect([...result.keys()]).toEqual([...original.keys()]);
    for (const [tag, data] of original) {
      expect(bytesOf(result, tag)).toEqual([...data]);
    }
  });
});

describe("woff2", () => {
  it("detects the container", async () => {
    const woff2 = new Uint8Array(await compress(trueTypeFont()));
    const info = readContainerInfo(woff2);
    expect(info.format).toBe("woff2");
    expect(info.label).toBe("WOFF2");
  });

  it("restores every table the encoder passes through untouched", async () => {
    const woff2 = new Uint8Array(await compress(trueTypeFont()));
    const result = tableMap(
      new Uint8Array(await decodeWoff2(woff2, decompress)),
    );
    const original = tableMap(trueTypeFont());

    // `head` is excluded on purpose: a WOFF2 encoder may zero `flags` and
    // rewrite `checkSumAdjustment`, so those bytes are not expected to match
    // the source font. Their meaningful fields are asserted below.
    for (const tag of ["cmap", "hhea", "hmtx", "maxp", "name", "post"]) {
      expect(bytesOf(result, tag)).toEqual(bytesOf(original, tag));
    }
  });

  it("rebuilds glyf, loca and hmtx from the transform", async () => {
    const source = parse(toArrayBuffer(trueTypeFont()));
    expect(source.outlinesFormat).toBe("truetype");

    const woff2 = new Uint8Array(await compress(trueTypeFont()));
    const unpacked = await decodeWoff2(woff2, decompress);
    const decoded = parse(unpacked);

    expect(decoded.nGlyphs).toBe(source.nGlyphs);
    expect(decoded.unitsPerEm).toBe(source.unitsPerEm);
    expect(decoded.ascender).toBe(source.ascender);
    expect(decoded.descender).toBe(source.descender);

    for (let glyphId = 0; glyphId < source.nGlyphs; glyphId++) {
      const rebuilt = decoded.glyphs.get(glyphId);
      const original = source.glyphs.get(glyphId);
      expect(rebuilt.advanceWidth).toBe(original.advanceWidth);
      expect(rebuilt.xMin).toBe(original.xMin);
      expect(rebuilt.yMin).toBe(original.yMin);
      expect(rebuilt.xMax).toBe(original.xMax);
      expect(rebuilt.yMax).toBe(original.yMax);
      expect(JSON.stringify(rebuilt.path.commands)).toBe(
        JSON.stringify(original.path.commands),
      );
    }
  });
});
