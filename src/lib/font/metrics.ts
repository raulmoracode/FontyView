import { formatMetric, orUnavailable } from "@/lib/format";

/**
 * A single vertical metric read from a real table. `null` means the font does
 * not carry the value, which is different from a value of zero.
 */
export type MetricRow = {
  label: string;
  value: number | null;
  source: string;
  note?: string;
};

export type FontMetrics = {
  unitsPerEm: number | null;
  ascender: number | null;
  descender: number | null;
  lineGap: number | null;
  capHeight: number | null;
  xHeight: number | null;
  typoAscender: number | null;
  typoDescender: number | null;
  typoLineGap: number | null;
  winAscent: number | null;
  winDescent: number | null;
  hheaAscender: number | null;
  hheaDescender: number | null;
  hheaLineGap: number | null;
  underlinePosition: number | null;
  underlineThickness: number | null;
  strikeoutPosition: number | null;
  strikeoutThickness: number | null;
  bbox: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
};

export function readFontMetrics(
  head: {
    unitsPerEm: number;
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
  } | null,
  hhea: {
    ascender: number;
    descender: number;
    lineGap: number;
  } | null,
  os2: {
    sTypoAscender: number;
    sTypoDescender: number;
    sTypoLineGap: number;
    usWinAscent: number;
    usWinDescent: number;
    sxHeight: number | null;
    sCapHeight: number | null;
    yStrikeoutSize: number;
    yStrikeoutPosition: number;
  } | null,
  post: {
    underlinePosition: number | null;
    underlineThickness: number | null;
  } | null,
): FontMetrics {
  return {
    unitsPerEm: head?.unitsPerEm ?? null,
    ascender: hhea?.ascender ?? null,
    descender: hhea?.descender ?? null,
    lineGap: hhea?.lineGap ?? null,
    capHeight: os2?.sCapHeight ?? null,
    xHeight: os2?.sxHeight ?? null,
    typoAscender: os2?.sTypoAscender ?? null,
    typoDescender: os2?.sTypoDescender ?? null,
    typoLineGap: os2?.sTypoLineGap ?? null,
    winAscent: os2?.usWinAscent ?? null,
    winDescent: os2?.usWinDescent ?? null,
    hheaAscender: hhea?.ascender ?? null,
    hheaDescender: hhea?.descender ?? null,
    hheaLineGap: hhea?.lineGap ?? null,
    underlinePosition: post?.underlinePosition ?? null,
    underlineThickness: post?.underlineThickness ?? null,
    strikeoutPosition: os2?.yStrikeoutPosition ?? null,
    strikeoutThickness: os2?.yStrikeoutSize ?? null,
    bbox: head
      ? { xMin: head.xMin, yMin: head.yMin, xMax: head.xMax, yMax: head.yMax }
      : null,
  };
}

export function metricGroups(metrics: FontMetrics): {
  label: string;
  rows: MetricRow[];
}[] {
  return [
    {
      label: "Design grid",
      rows: [
        {
          label: "Units per em",
          value: metrics.unitsPerEm,
          source: "head",
          note: "The design grid the font is drawn on.",
        },
      ],
    },
    {
      label: "hhea (horizontal header)",
      rows: [
        { label: "Ascender", value: metrics.hheaAscender, source: "hhea" },
        { label: "Descender", value: metrics.hheaDescender, source: "hhea" },
        { label: "Line gap", value: metrics.hheaLineGap, source: "hhea" },
      ],
    },
    {
      label: "OS/2 typo metrics",
      rows: [
        {
          label: "Typographic ascender",
          value: metrics.typoAscender,
          source: "OS/2",
        },
        {
          label: "Typographic descender",
          value: metrics.typoDescender,
          source: "OS/2",
        },
        {
          label: "Typographic line gap",
          value: metrics.typoLineGap,
          source: "OS/2",
        },
      ],
    },
    {
      label: "OS/2 win metrics",
      rows: [
        { label: "Windows ascent", value: metrics.winAscent, source: "OS/2" },
        { label: "Windows descent", value: metrics.winDescent, source: "OS/2" },
      ],
    },
    {
      label: "Cap and x-height",
      rows: [
        {
          label: "Cap height",
          value: metrics.capHeight,
          source: "OS/2",
          note: "Height of a capital letter, above the baseline.",
        },
        {
          label: "x-height",
          value: metrics.xHeight,
          source: "OS/2",
          note: "Height of a lowercase x, above the baseline.",
        },
      ],
    },
    {
      label: "Lines",
      rows: [
        {
          label: "Underline position",
          value: metrics.underlinePosition,
          source: "post",
        },
        {
          label: "Underline thickness",
          value: metrics.underlineThickness,
          source: "post",
        },
        {
          label: "Strikeout position",
          value: metrics.strikeoutPosition,
          source: "OS/2",
        },
        {
          label: "Strikeout thickness",
          value: metrics.strikeoutThickness,
          source: "OS/2",
        },
      ],
    },
  ];
}

export function formatMetricValue(value: number | null): string {
  return value === null ? "Not available" : formatMetric(value);
}

export { orUnavailable };
