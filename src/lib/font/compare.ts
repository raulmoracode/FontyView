import { formatNumber } from "../format";
import type { LoadedFont } from "./analyze";

/** One comparable row: a label and each font's value for it. */
export type ComparisonRow = {
  label: string;
  group: string;
  left: string | number | null;
  right: string | number | null;
  /** True when the two fonts disagree. */
  differs: boolean;
};

export type TableDifference = {
  tag: string;
  /** Only present in one font, or a size change when both have it. */
  kind: "only-left" | "only-right" | "size";
  left: number | null;
  right: number | null;
};

export type Comparison = {
  rows: ComparisonRow[];
  /** Rows that differ, so a view can start with the interesting ones. */
  differing: number;
  tables: TableDifference[];
  features: {
    onlyLeft: string[];
    onlyRight: string[];
    shared: string[];
  };
};

function value(
  loaded: LoadedFont,
  read: (font: LoadedFont) => string | number | null | undefined,
): string | number | null {
  const result = read(loaded);
  return result === undefined ? null : result;
}

function same(left: string | number | null, right: string | number | null) {
  return left === right;
}

/**
 * Compares two analyses on the axes a designer checks first: identity,
 * coverage, vertical metrics, advances and features.
 *
 * Nothing here judges which font is better. A larger glyph count is not
 * obviously an improvement, so every row reports both values and whether they
 * differ, and leaves the reading to the person comparing them.
 */
export function compareFonts(left: LoadedFont, right: LoadedFont): Comparison {
  const definitions: {
    group: string;
    label: string;
    read: (font: LoadedFont) => string | number | null | undefined;
  }[] = [
    {
      group: "Identity",
      label: "Family",
      read: (f) => f.analysis.metadata.familyName,
    },
    {
      group: "Identity",
      label: "Subfamily",
      read: (f) => f.analysis.metadata.subfamilyName,
    },
    {
      group: "Identity",
      label: "PostScript name",
      read: (f) => f.analysis.metadata.postScriptName,
    },
    {
      group: "Identity",
      label: "Version",
      read: (f) => f.analysis.metadata.version,
    },
    {
      group: "Identity",
      label: "Container",
      read: (f) => f.analysis.file.label,
    },
    {
      group: "Identity",
      label: "Outlines",
      read: (f) => f.analysis.outlineFormat,
    },
    {
      group: "Identity",
      label: "File size",
      read: (f) => f.analysis.file.fileSize,
    },
    {
      group: "Coverage",
      label: "Glyphs",
      read: (f) => f.analysis.statistics.glyphCount,
    },
    {
      group: "Coverage",
      label: "Encoded characters",
      read: (f) => f.analysis.statistics.unicodePoints,
    },
    {
      group: "Coverage",
      label: "Tables",
      read: (f) => f.structure.directory.tables.length,
    },
    {
      group: "Coverage",
      label: "Scripts",
      read: (f) => f.analysis.scripts.length,
    },
    {
      group: "Vertical metrics",
      label: "unitsPerEm",
      read: (f) => f.structure.head?.unitsPerEm ?? null,
    },
    {
      group: "Vertical metrics",
      label: "Ascender",
      read: (f) => f.structure.hhea?.ascender ?? null,
    },
    {
      group: "Vertical metrics",
      label: "Descender",
      read: (f) => f.structure.hhea?.descender ?? null,
    },
    {
      group: "Vertical metrics",
      label: "Line gap",
      read: (f) => f.structure.hhea?.lineGap ?? null,
    },
    {
      group: "Vertical metrics",
      label: "Cap height",
      read: (f) => f.structure.os2?.sCapHeight ?? null,
    },
    {
      group: "Vertical metrics",
      label: "x-height",
      read: (f) => f.structure.os2?.sxHeight ?? null,
    },
    {
      group: "Horizontal metrics",
      label: "Average advance",
      read: (f) => f.analysis.statistics.averageAdvance ?? null,
    },
    {
      group: "Horizontal metrics",
      label: "Minimum advance",
      read: (f) => f.analysis.statistics.minimumAdvance ?? null,
    },
    {
      group: "Horizontal metrics",
      label: "Maximum advance",
      read: (f) => f.analysis.statistics.maximumAdvance ?? null,
    },
    {
      group: "Classification",
      label: "Weight class",
      read: (f) => f.structure.os2?.usWeightClass ?? null,
    },
    {
      group: "Classification",
      label: "Width class",
      read: (f) => f.structure.os2?.usWidthClass ?? null,
    },
    {
      group: "Classification",
      label: "Italic angle",
      read: (f) => f.structure.post?.italicAngle ?? null,
    },
    {
      group: "Classification",
      label: "Fixed pitch",
      read: (f) => {
        const value = f.structure.post?.isFixedPitch;
        return value === null || value === undefined
          ? null
          : value
            ? "Yes"
            : "No";
      },
    },
    {
      group: "Layout",
      label: "Variation axes",
      read: (f) => f.structure.variation.axes.length,
    },
    {
      group: "Layout",
      label: "Kerning pairs",
      read: (f) => f.structure.kerning.pairs.size,
    },
    {
      group: "Layout",
      label: "Ligatures",
      read: (f) =>
        f.structure.layout.find((table) => table.kind === "GSUB")?.ligatures
          .length ?? 0,
    },
  ];

  const rows: ComparisonRow[] = definitions.map((definition) => {
    const leftValue = value(left, definition.read);
    const rightValue = value(right, definition.read);
    return {
      label: definition.label,
      group: definition.group,
      left: leftValue,
      right: rightValue,
      differs: !same(leftValue, rightValue),
    };
  });

  const sizes = (font: LoadedFont) =>
    new Map(
      font.structure.tableSizes.map((table) => [table.tag, table.length]),
    );

  const leftSizes = sizes(left);
  const rightSizes = sizes(right);
  const tags = [...new Set([...leftSizes.keys(), ...rightSizes.keys()])].sort();

  const tables: TableDifference[] = [];
  for (const tag of tags) {
    const leftSize = leftSizes.get(tag) ?? null;
    const rightSize = rightSizes.get(tag) ?? null;
    if (leftSize === null) {
      tables.push({ tag, kind: "only-right", left: null, right: rightSize });
    } else if (rightSize === null) {
      tables.push({ tag, kind: "only-left", left: leftSize, right: null });
    } else if (leftSize !== rightSize) {
      tables.push({ tag, kind: "size", left: leftSize, right: rightSize });
    }
  }

  const featureTags = (font: LoadedFont) => {
    const tags = new Set<string>();
    for (const table of font.structure.layout) {
      for (const feature of table.features) tags.add(feature.tag);
    }
    return tags;
  };
  const leftFeatures = featureTags(left);
  const rightFeatures = featureTags(right);

  const shared: string[] = [];
  const onlyLeft: string[] = [];
  const onlyRight: string[] = [];
  for (const tag of [...leftFeatures].sort()) {
    if (rightFeatures.has(tag)) shared.push(tag);
    else onlyLeft.push(tag);
  }
  for (const tag of [...rightFeatures].sort()) {
    if (!leftFeatures.has(tag)) onlyRight.push(tag);
  }

  return {
    rows,
    differing: rows.filter((row) => row.differs).length,
    tables,
    features: { onlyLeft, onlyRight, shared },
  };
}

/** The rows of one group, in the order the comparison declares them. */
export function rowsInGroup(
  comparison: Comparison,
  group: string,
): ComparisonRow[] {
  return comparison.rows.filter((row) => row.group === group);
}

/** The groups that actually have rows, in declaration order. */
export function comparisonGroups(comparison: Comparison): string[] {
  const groups: string[] = [];
  for (const row of comparison.rows) {
    if (!groups.includes(row.group)) groups.push(row.group);
  }
  return groups;
}

export function formatComparisonValue(
  entry: string | number | null,
  other: string | number | null,
): string {
  if (entry === null) return "Not available";
  if (typeof entry === "number") {
    const suffix =
      other !== null && typeof other === "number" && entry !== other
        ? ` (${entry > other ? "+" : ""}${formatNumber(entry - other)})`
        : "";
    return `${formatNumber(entry)}${suffix}`;
  }
  return entry;
}
