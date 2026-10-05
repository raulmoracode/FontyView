import { useId } from "react";
import type { FontMetrics } from "@/lib/font/metrics";
import { formatMetricValue } from "@/lib/font/metrics";

/**
 * Draws the font's real vertical metrics to scale.
 *
 * Every line sits at its actual position in font units against the em square,
 * so the relationship between ascender, cap height, x-height and descender is
 * visible rather than only tabulated. Metrics the font lacks are simply not
 * drawn, and no line is invented to fill a gap.
 */

type Guide = {
  key: string;
  label: string;
  value: number;
  source: string;
  tone: "line" | "mark";
};

type GuideSpec = Omit<Guide, "value"> & { value: number | null };

const WIDTH = 520;
const HEIGHT = 300;
const LEFT = 96;
const RIGHT = 24;
const TOP = 24;
const BOTTOM = 40;

export function MetricsDiagram({ metrics }: { metrics: FontMetrics }) {
  const gradientId = useId();
  const unitsPerEm = metrics.unitsPerEm ?? 1000;

  const specs: GuideSpec[] = [
    {
      key: "ascender",
      label: "Ascender",
      value: metrics.ascender,
      source: "hhea ascender",
      tone: "line",
    },
    {
      key: "typoAsc",
      label: "Typo ascender",
      value: metrics.typoAscender,
      source: "OS/2 sTypoAscender",
      tone: "line",
    },
    {
      key: "winAsc",
      label: "Win ascent",
      value: metrics.winAscent,
      source: "OS/2 usWinAscent",
      tone: "line",
    },
    {
      key: "cap",
      label: "Cap height",
      value: metrics.capHeight,
      source: "OS/2 sCapHeight",
      tone: "line",
    },
    {
      key: "x",
      label: "x-height",
      value: metrics.xHeight,
      source: "OS/2 sxHeight",
      tone: "line",
    },
    {
      key: "strikeout",
      label: "Strikeout",
      value: metrics.strikeoutPosition,
      source: "OS/2 yStrikeoutPosition",
      tone: "mark",
    },
    {
      key: "underline",
      label: "Underline",
      value: metrics.underlinePosition,
      source: "post underlinePosition",
      tone: "mark",
    },
    {
      key: "descender",
      label: "Descender",
      value: metrics.descender,
      source: "hhea descender",
      tone: "line",
    },
    {
      key: "typoDesc",
      label: "Typo descender",
      value: metrics.typoDescender,
      source: "OS/2 sTypoDescender",
      tone: "line",
    },
    {
      key: "winDesc",
      label: "Win descent",
      value: metrics.winDescent === null ? null : -metrics.winDescent,
      source: "OS/2 usWinDescent",
      tone: "line",
    },
  ];

  const guides: Guide[] = specs.filter(
    (guide): guide is Guide => guide.value !== null,
  );

  const top = Math.max(
    unitsPerEm / 2,
    0,
    ...guides.map((guide) => guide.value),
  );
  const bottom = Math.min(
    -unitsPerEm / 4,
    0,
    ...guides.map((guide) => guide.value),
  );

  const plotHeight = HEIGHT - TOP - BOTTOM;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const range = top - bottom || 1;
  const toY = (units: number) => TOP + ((top - units) / range) * plotHeight;

  const baselineY = toY(0);
  const xHeightY = metrics.xHeight === null ? null : toY(metrics.xHeight);
  const capY = metrics.capHeight === null ? null : toY(metrics.capHeight);
  const emTop = toY(unitsPerEm / 2);
  const emBottom = toY(-unitsPerEm / 2);

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-2xl"
        role="img"
        aria-label="Vertical metrics diagram"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Em square, for scale. */}
        <rect
          x={LEFT}
          y={emTop}
          width={plotWidth}
          height={emBottom - emTop}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeDasharray="3 3"
        />

        {/* x-height band, then the cap band, so the two read as a comparison. */}
        {xHeightY === null ? null : (
          <rect
            x={LEFT}
            y={xHeightY}
            width={plotWidth}
            height={baselineY - xHeightY}
            fill={`url(#${gradientId})`}
          />
        )}
        {capY === null ? null : (
          <rect
            x={LEFT}
            y={capY}
            width={plotWidth}
            height={baselineY - capY}
            fill="currentColor"
            fillOpacity="0.05"
          />
        )}

        <line
          x1={LEFT}
          y1={baselineY}
          x2={WIDTH - RIGHT}
          y2={baselineY}
          stroke="currentColor"
          strokeWidth="1.25"
        />

        {guides.map((guide) => {
          const y = toY(guide.value);
          const isMark = guide.tone === "mark";
          return (
            <g key={guide.key}>
              <line
                x1={LEFT}
                y1={y}
                x2={WIDTH - RIGHT}
                y2={y}
                stroke="currentColor"
                strokeOpacity={isMark ? 0.22 : 0.4}
                strokeDasharray={isMark ? "2 4" : undefined}
              />
              <text
                x={LEFT - 8}
                y={y + 3.5}
                textAnchor="end"
                style={{ fontSize: 10 }}
                className="fill-current"
              >
                {guide.label}
              </text>
              <text
                x={WIDTH - RIGHT}
                y={y + 3.5}
                textAnchor="end"
                style={{ fontSize: 10 }}
                className="fill-current opacity-60"
              >
                {formatMetricValue(guide.value)}
              </text>
            </g>
          );
        })}

        <text
          x={LEFT}
          y={HEIGHT - 10}
          style={{ fontSize: 10 }}
          className="fill-current opacity-60"
        >
          em square {formatMetricValue(metrics.unitsPerEm)} units
        </text>
        <text
          x={WIDTH - RIGHT}
          y={HEIGHT - 10}
          textAnchor="end"
          style={{ fontSize: 10 }}
          className="fill-current opacity-60"
        >
          line gap {formatMetricValue(metrics.lineGap)}
        </text>
      </svg>

      <dl className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
        {guides.map((guide) => (
          <div
            key={guide.key}
            className="flex justify-between gap-4 border-b border-border/50 py-0.5"
          >
            <dt className="text-muted-foreground">{guide.source}</dt>
            <dd className="font-mono tabular-nums">
              {formatMetricValue(guide.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
