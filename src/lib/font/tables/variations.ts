import { BinaryReader } from "../binary-reader";
import type { NameRecord } from "./core";

/**
 * `fvar` (font variations) and `avar` (axis value mapping).
 *
 * Axes are reported exactly as the font declares them. The `slnt` convention of
 * negative values meaning a negative slant is normalised to the intuitive sign
 * so a slider can be labelled in degrees, but the raw minimum and maximum are
 * kept alongside.
 */

export type VariationAxis = {
  tag: string;
  /** Human-readable name from the `name` table. */
  name: string;
  minimum: number;
  default: number;
  maximum: number;
  /** Precision declared by the font, used when rounding for display. */
  precision: number;
  /** True when the font uses the negative-slant convention for `slnt`. */
  isNegative: boolean;
};

export type NamedInstance = {
  name: string;
  /** Axis coordinates, in the font's own units. */
  coordinates: Record<string, number>;
  postScriptName: string | null;
};

export type VariationData = {
  axes: VariationAxis[];
  instances: NamedInstance[];
  /** The `STAT` table, when the font has one. */
  hasStat: boolean;
  hasAvar: boolean;
  hasGvar: boolean;
  hasHvar: boolean;
  isVariable: boolean;
};

function axisName(records: NameRecord[], tag: string, index: number): string {
  // Variation axis and instance names live at name IDs 256 upwards, in the same
  // order the fvar table declares them.
  const record = records.find(
    (entry) => entry.nameId === 256 + index && entry.value.length > 0,
  );
  if (record) return record.value;
  return tag;
}

function instanceName(
  records: NameRecord[],
  axisCount: number,
  index: number,
): string {
  const record = records.find(
    (entry) =>
      entry.nameId === 256 + axisCount + index && entry.value.length > 0,
  );
  return record?.value ?? "";
}

export function parseFvar(
  bytes: Uint8Array,
  records: NameRecord[],
): { axes: VariationAxis[]; instances: NamedInstance[] } {
  const reader = new BinaryReader(bytes);
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const axesArrayOffset = reader.uint16();
  const reserved = reader.uint16();
  const axisCount = reader.uint16();
  const axisSize = reader.uint16();
  const instanceCount = reader.uint16();
  const instanceSize = reader.uint16();
  void majorVersion;
  void minorVersion;
  void reserved;
  void instanceSize;

  const axes: VariationAxis[] = [];
  for (let i = 0; i < axisCount; i++) {
    const at = axesArrayOffset + i * axisSize;
    if (at + 20 > bytes.byteLength) break;
    const axis = new BinaryReader(bytes).seek(at);
    const tag = axis.tag();
    const minimum = axis.fixed();
    const defaultValue = axis.fixed();
    const maximum = axis.fixed();
    const flags = axis.uint16();
    const nameId = axis.uint16();

    axes.push({
      tag,
      name: axisName(records, tag, nameId - 256),
      minimum,
      default: defaultValue,
      maximum,
      precision: flags & 0x00ff,
      isNegative: tag === "slnt" && maximum <= 0 && minimum < 0,
    });
  }

  // An instance record holds a subfamily name ID, flags, one coordinate per
  // axis and a PostScript name ID. Real fonts disagree about `instanceSize`:
  // STIX Two Text declares 8 and Skia declares 12, both fewer than the bytes
  // their own records occupy. Stepping by the declared size would walk the
  // table out of step, so the size the reader actually consumes is what
  // advances, and reading stops rather than throwing when the table ends early.
  const recordSize = 4 + axisCount * 4 + 2;
  const instances: NamedInstance[] = [];
  let at = axesArrayOffset + axisCount * axisSize;
  for (let i = 0; i < instanceCount; i++) {
    if (at + recordSize > bytes.byteLength) break;
    const instance = new BinaryReader(bytes).seek(at);
    const subfamilyNameId = instance.uint16();
    instance.uint16(); // flags
    const coordinates: Record<string, number> = {};
    axes.forEach((axis, axisIndex) => {
      coordinates[axis.tag] = instance.fixed();
      void axisIndex;
    });
    const postScriptNameId = instance.uint16();

    const name =
      records.find(
        (entry) => entry.nameId === subfamilyNameId && entry.value.length > 0,
      )?.value ??
      instanceName(records, axisCount, i) ??
      "";

    const postScriptName =
      records.find(
        (entry) => entry.nameId === postScriptNameId && entry.value.length > 0,
      )?.value ?? null;

    instances.push({ name, coordinates, postScriptName });
    at += recordSize;
  }

  return { axes, instances };
}

export function readVariationData(
  tables: {
    fvar: Uint8Array | null;
    avar: Uint8Array | null;
    gvar: Uint8Array | null;
    hvar: Uint8Array | null;
    stat: Uint8Array | null;
  },
  records: NameRecord[],
): VariationData {
  if (!tables.fvar) {
    return {
      axes: [],
      instances: [],
      hasStat: tables.stat !== null,
      hasAvar: false,
      hasGvar: false,
      hasHvar: false,
      isVariable: false,
    };
  }

  const { axes, instances } = parseFvar(tables.fvar, records);

  return {
    axes,
    instances,
    hasStat: tables.stat !== null,
    hasAvar: tables.avar !== null,
    hasGvar: tables.gvar !== null,
    hasHvar: tables.hvar !== null,
    isVariable: axes.length > 0,
  };
}

/**
 * The CSS value for an axis.
 *
 * `slnt` is declared as a negative number by convention, which is what CSS
 * expects, so the raw value is used unchanged.
 */
export function cssAxisValue(axis: VariationAxis, value: number): number {
  return axis.isNegative ? -Math.abs(value) : value;
}

export function formatAxisValue(axis: VariationAxis, value: number): string {
  const decimals = axis.tag === "opsz" ? 0 : axis.precision;
  return value.toFixed(decimals);
}

export function toVariationSettings(
  axes: VariationAxis[],
  values: Record<string, number>,
): string {
  const parts: string[] = [];
  for (const axis of axes) {
    const value = values[axis.tag] ?? axis.default;
    if (value === axis.default) continue;
    parts.push(
      `"${axis.tag}" ${formatAxisValue(axis, cssAxisValue(axis, value))}`,
    );
  }
  return parts.length > 0 ? parts.join(", ") : "normal";
}
