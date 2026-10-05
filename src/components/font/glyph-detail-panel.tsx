import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { RawGlyph } from "@/lib/font/tables/glyf";
import { CATEGORY_LABELS } from "@/lib/font/unicode-category";
import { formatCodepoint } from "@/lib/font/unicode-data";
import { formatNumber, orUnavailable } from "@/lib/format";

export type GlyphDetail = {
  glyphId: number;
  name: string | null;
  /** Available only for TrueType-outline fonts, where `glyf` is readable. */
  raw: RawGlyph | null;
  advanceWidth: number | null;
  leftSideBearing: number | null;
  /** Bounding box from the `glyf` record, when the font is TrueType. */
  xMin: number | null;
  yMin: number | null;
  xMax: number | null;
  yMax: number | null;
  unitsPerEm: number | null;
};

function metric(value: number | null): string {
  return value === null ? "Not available" : formatNumber(value);
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <TableRow>
      <TableCell className="w-52 align-top text-muted-foreground">
        {label}
        {hint ? (
          <span className="mt-0.5 block text-xs opacity-70">{hint}</span>
        ) : null}
      </TableCell>
      <TableCell className="align-top font-mono text-sm break-words">
        {value}
      </TableCell>
    </TableRow>
  );
}

/**
 * A glyph's own space, drawn to scale, so the relationship between the outline,
 * the side bearings and the advance width is visible.
 */
function GlyphBox({
  detail,
  family,
  char,
}: {
  detail: GlyphDetail;
  family: string;
  char: string | null;
}) {
  const { advanceWidth, xMin, yMin, xMax, yMax, unitsPerEm } = detail;

  if (
    advanceWidth === null ||
    xMin === null ||
    yMin === null ||
    xMax === null ||
    yMax === null
  ) {
    return null;
  }

  const padding = 24;
  const width = Math.max(advanceWidth, xMax, 1);
  const height = Math.max(yMax - yMin, 1);
  const scale = 160 / Math.max(width, height);
  const boxWidth = width * scale + padding * 2;
  const boxHeight = height * scale + padding * 2;
  const toX = (units: number) => padding + units * scale;
  const toY = (units: number) => padding + (yMax - units) * scale;

  return (
    <svg
      viewBox={`0 0 ${boxWidth} ${boxHeight}`}
      className="h-40 w-full"
      role="img"
      aria-label="Glyph bounding box, side bearings and advance width"
    >
      {/* Advance width. */}
      <rect
        x={toX(0)}
        y={0}
        width={advanceWidth * scale}
        height={boxHeight}
        fill="currentColor"
        fillOpacity="0.06"
      />
      <line
        x1={toX(0)}
        y1={0}
        x2={toX(0)}
        y2={boxHeight}
        stroke="currentColor"
        strokeOpacity="0.4"
      />
      <line
        x1={toX(advanceWidth)}
        y1={0}
        x2={toX(advanceWidth)}
        y2={boxHeight}
        stroke="currentColor"
        strokeOpacity="0.4"
      />

      {/* Bounding box. */}
      <rect
        x={toX(xMin)}
        y={toY(yMax)}
        width={(xMax - xMin) * scale}
        height={(yMax - yMin) * scale}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeDasharray="3 2"
      />

      {/* Baseline, when it falls inside the box. */}
      {yMin < 0 && yMax > 0 ? (
        <line
          x1={padding * 0.4}
          y1={toY(0)}
          x2={boxWidth - padding * 0.4}
          y2={toY(0)}
          stroke="currentColor"
          strokeWidth="1.25"
        />
      ) : null}

      {char ? (
        <text
          x={toX(0) + (xMin * scale) / 2 + (xMin === 0 ? 0 : 0)}
          y={toY(0)}
          textAnchor="middle"
          dominantBaseline="alphabetic"
          style={{
            fontSize: Math.max(8, height * scale * 0.9),
            fontFamily: `"${family}", monospace`,
          }}
        >
          {char}
        </text>
      ) : null}

      <text
        x={padding * 0.4}
        y={boxHeight - 2}
        style={{ fontSize: 9 }}
        className="fill-current opacity-60"
      >
        em {formatNumber(unitsPerEm)} units
      </text>
    </svg>
  );
}

export function GlyphDetailPanel({
  detail,
  family,
  char,
  codepoints,
  category,
}: {
  detail: GlyphDetail;
  family: string;
  char: string | null;
  codepoints: number[];
  category: string;
}) {
  const raw = detail.raw;
  const rightBearing = useMemo(() => {
    if (detail.advanceWidth === null) return null;
    if (raw === null) return null;
    return detail.advanceWidth - raw.xMax;
  }, [detail.advanceWidth, raw]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline gap-4">
        <span
          className="text-5xl leading-none"
          style={{ fontFamily: `"${family}", monospace` }}
        >
          {char ?? (
            <span className="font-mono text-2xl text-muted-foreground">
              gid {detail.glyphId}
            </span>
          )}
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {detail.name ?? `Glyph ${detail.glyphId}`}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {codepoints.map((codepoint) => (
              <Badge key={codepoint} variant="secondary" className="font-mono">
                {formatCodepoint(codepoint)}
              </Badge>
            ))}
            <Badge variant="outline">
              {CATEGORY_LABELS[category as never] ?? category}
            </Badge>
          </div>
        </div>
      </header>

      <GlyphBox detail={detail} family={family} char={char} />

      <Table>
        <TableBody>
          <Row label="Glyph ID" value={formatNumber(detail.glyphId)} />
          <Row label="Name" value={orUnavailable(detail.name)} />
          <Row
            label="Unicode"
            value={
              codepoints.length > 0
                ? codepoints.map(formatCodepoint).join(", ")
                : "Not available"
            }
          />
          <Row label="Advance width" value={metric(detail.advanceWidth)} />
          <Row
            label="Left side bearing"
            value={metric(detail.leftSideBearing)}
            hint="Distance from the origin to the leftmost point of the outline."
          />
          <Row
            label="Right side bearing"
            value={metric(rightBearing)}
            hint="Advance width minus xMax."
          />
        </TableBody>
      </Table>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          Bounding box
        </h3>
        {raw === null ? (
          <p className="text-sm text-muted-foreground">
            This font uses CFF outlines, so there is no per-glyph bounding box
            record to read. The outline is available in the outline viewer
            instead.
          </p>
        ) : (
          <Table>
            <TableBody>
              <Row label="xMin" value={metric(detail.xMin)} />
              <Row label="yMin" value={metric(detail.yMin)} />
              <Row label="xMax" value={metric(detail.xMax)} />
              <Row label="yMax" value={metric(detail.yMax)} />
              <Row label="Width" value={metric(raw.xMax - raw.xMin)} />
              <Row label="Height" value={metric(raw.yMax - raw.yMin)} />
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Outline</h3>
        {raw === null ? (
          <p className="text-sm text-muted-foreground">
            No `glyf` record: this font stores outlines as CFF charstrings.
          </p>
        ) : (
          <Table>
            <TableBody>
              <Row
                label="Contours"
                value={
                  raw.isComposite
                    ? "Composite"
                    : formatNumber(raw.numberOfContours)
                }
              />
              <Row label="Points" value={formatNumber(raw.points.length)} />
              <Row
                label="Components"
                value={formatNumber(raw.components.length)}
              />
              <Row
                label="Instructions"
                value={formatNumber(raw.instructionLength)}
                hint="Bytes of hinting bytecode."
              />
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
