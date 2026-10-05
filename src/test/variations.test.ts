/// <reference types="node" />
import { describe, expect, it } from "vitest";
import type { NameRecord } from "@/lib/font/tables/core";
import { parseFvar } from "@/lib/font/tables/variations";
import { buildFvarWithSizes } from "./fixtures/truetype-builder";

function names(records: { nameId: number; value: string }[]): NameRecord[] {
  return records.map((record) => ({
    nameId: record.nameId,
    label: "",
    platformId: 3,
    platform: "Windows",
    encodingId: 1,
    languageId: 0x409,
    language: "en",
    value: record.value,
  }));
}

describe("fvar instance sizes", () => {
  // STIX Two Text, Skia and Noto Sans Syriac all declare an instanceSize
  // smaller than the bytes an instance actually occupies. Reading past the
  // table threw "Unexpected end of data" and aborted the whole analysis.
  it("accepts an instanceSize smaller than the fields it holds", () => {
    const { fvar } = buildFvarWithSizes(
      [{ tag: "wght", name: "Weight" }],
      [{ name: "Regular", coordinates: [400 << 16] }],
      256,
      { axisSize: 20, instanceSize: 8 },
    );

    const { axes, instances } = parseFvar(fvar, []);

    expect(axes).toHaveLength(1);
    expect(axes[0].tag).toBe("wght");
    expect(instances).toHaveLength(1);
    expect(instances[0].coordinates.wght).toBeCloseTo(400, 1);
  });

  it("keeps every instance the table can hold", () => {
    const { fvar } = buildFvarWithSizes(
      [{ tag: "wght", name: "Weight" }],
      [
        { name: "Light", coordinates: [300 << 16] },
        { name: "Regular", coordinates: [400 << 16] },
        { name: "Bold", coordinates: [700 << 16] },
      ],
      256,
      { axisSize: 20, instanceSize: 10 },
    );

    // Header 16 bytes, one axis of 20, three instances of 10.
    expect(fvar.byteLength).toBe(16 + 20 + 3 * 10 + 2);
    const { instances } = parseFvar(fvar, []);
    expect(instances).toHaveLength(3);
    expect(instances[2].coordinates.wght).toBeCloseTo(700, 1);
  });

  it("keeps the whole table when the size is correct", () => {
    const { fvar } = buildFvarWithSizes(
      [
        { tag: "wght", name: "Weight" },
        { tag: "wdth", name: "Width" },
      ],
      [
        { name: "Regular", coordinates: [400 << 16, 100 << 16] },
        { name: "Bold", coordinates: [700 << 16, 100 << 16] },
      ],
      256,
      { axisSize: 20, instanceSize: 14 },
    );

    const { instances } = parseFvar(fvar, []);
    expect(instances).toHaveLength(2);
    expect(instances[1].coordinates.wght).toBeCloseTo(700, 1);
    expect(instances[1].coordinates.wdth).toBeCloseTo(100, 1);
  });

  it("names axes from the name table", () => {
    const built = buildFvarWithSizes(
      [{ tag: "wght", name: "Weight" }],
      [{ name: "Regular", coordinates: [400 << 16] }],
      256,
      { axisSize: 20, instanceSize: 10 },
    );

    const { axes } = parseFvar(built.fvar, names(built.names));
    expect(axes[0].name).toBe("Weight");
  });
});
