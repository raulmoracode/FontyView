import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { contoursToPath } from "@/lib/font/outline-path";
import type { RawGlyph } from "@/lib/font/tables/glyf";
import { formatNumber } from "@/lib/format";

type Props = {
  glyph: RawGlyph | null;
  glyphName: string | null;
  advanceWidth: number | null;
  /** Names of the components referenced by a composite glyph. */
  componentNames: (glyphId: number) => string | null;
  available: boolean;
};

const ZOOM_STEPS = [0.5, 1, 2, 4, 8];

export function GlyphOutlineViewer({
  glyph,
  glyphName,
  advanceWidth,
  componentNames,
  available,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [showPoints, setShowPoints] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [view, setView] = useState<"outline" | "points" | "boxes">("outline");

  const path = useMemo(
    () => (glyph ? contoursToPath(glyph.contours) : ""),
    [glyph],
  );

  if (!available || !glyph) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            OUTLINE
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font stores outlines as CFF charstrings, so the original
              point data is not available to inspect. The rendered outline is
              still drawn on the specimen and in the glyph grid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (glyph.isEmpty) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            OUTLINE
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This glyph is empty: it has no contours, only a{" "}
              {formatNumber(advanceWidth)}-unit advance width.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const width = glyph.xMax - glyph.xMin || 1;
  const height = glyph.yMax - glyph.yMin || 1;
  const padding = Math.max(width, height) * 0.15;
  const viewBox = `${glyph.xMin - padding} ${-glyph.yMax - padding} ${width + padding * 2} ${height + padding * 2}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          OUTLINE
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {glyph.isComposite ? (
            <Badge variant="secondary">Composite</Badge>
          ) : (
            <Badge variant="secondary">
              {formatNumber(glyph.numberOfContours)} contours
            </Badge>
          )}
          <Badge variant="outline">
            {formatNumber(glyph.points.length)} points
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{glyphName ?? `Glyph ${glyph.glyphId}`}</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={view}
              onValueChange={(value) => setView(value as typeof view)}
            >
              <SelectTrigger className="w-36" aria-label="Outline view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="points">Points</SelectItem>
                <SelectItem value="boxes">Metrics</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_STEPS[0]}
              onClick={() =>
                setZoom((current) => {
                  const index = ZOOM_STEPS.indexOf(current);
                  return ZOOM_STEPS[Math.max(0, index - 1)];
                })
              }
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="w-12 text-center font-mono text-xs tabular-nums">
              {zoom}×
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              onClick={() =>
                setZoom((current) => {
                  const index = ZOOM_STEPS.indexOf(current);
                  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, index + 1)];
                })
              }
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <svg
            viewBox={viewBox}
            style={{ height: `${Math.min(480, 240 * zoom)}px` }}
            className="w-full"
            role="img"
            aria-label={`Outline of ${glyphName ?? `glyph ${glyph.glyphId}`}`}
          >
            {showBaseline && glyph.yMin < 0 && glyph.yMax > 0 ? (
              <line
                x1={glyph.xMin - padding}
                y1={0}
                x2={glyph.xMax + padding}
                y2={0}
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth={(height + padding * 2) / 400}
              />
            ) : null}

            {showBox ? (
              <rect
                x={glyph.xMin}
                y={-glyph.yMax}
                width={width}
                height={height}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeDasharray={`${(width + padding * 2) / 40} ${(width + padding * 2) / 40}`}
              />
            ) : null}

            {path ? (
              <path
                d={path}
                fill="currentColor"
                fillOpacity="0.08"
                stroke="currentColor"
                strokeWidth={(width + padding * 2) / 300}
                strokeLinejoin="round"
              />
            ) : null}

            {showHandles && !glyph.isComposite
              ? glyph.contours.flatMap((contour) =>
                  contour.points
                    .filter((point) => !point.onCurve)
                    .map((point, index) => {
                      const next =
                        contour.points[
                          (contour.points.indexOf(point) + 1) %
                            contour.points.length
                        ];
                      const midX = next ? (point.x + next.x) / 2 : point.x;
                      const midY = next ? (point.y + next.y) / 2 : point.y;
                      return (
                        <g key={`handle-${index}-${point.x}-${point.y}`}>
                          <line
                            x1={point.x}
                            y1={-point.y}
                            x2={midX}
                            y2={-midY}
                            stroke="currentColor"
                            strokeOpacity="0.4"
                            strokeWidth={(width + padding * 2) / 500}
                          />
                          <circle
                            cx={midX}
                            cy={-midY}
                            r={(width + padding * 2) / 160}
                            fill="currentColor"
                            fillOpacity="0.35"
                          />
                        </g>
                      );
                    }),
                )
              : null}

            {showPoints && !glyph.isComposite
              ? glyph.points.map((point, index) => (
                  <circle
                    key={`point-${index}`}
                    cx={point.x}
                    cy={-point.y}
                    r={(width + padding * 2) / 180}
                    fill={point.onCurve ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={(width + padding * 2) / 400}
                  >
                    <title>
                      {`Point ${index}: ${point.onCurve ? "on" : "off"}-curve (${point.x}, ${point.y})`}
                    </title>
                  </circle>
                ))
              : null}
          </svg>

          {view === "points" && glyph.points.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {formatNumber(
                glyph.points.filter((point) => point.onCurve).length,
              )}{" "}
              on-curve,{" "}
              {formatNumber(
                glyph.points.filter((point) => !point.onCurve).length,
              )}{" "}
              off-curve across {formatNumber(glyph.numberOfContours)} contours.
            </p>
          ) : null}

          {view === "boxes" ? (
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {(
                [
                  ["xMin", glyph.xMin],
                  ["yMin", glyph.yMin],
                  ["xMax", glyph.xMax],
                  ["yMax", glyph.yMax],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatNumber(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-6">
        {(
          [
            ["Points", showPoints, setShowPoints],
            ["Handles", showHandles, setShowHandles],
            ["Bounding box", showBox, setShowBox],
            ["Baseline", showBaseline, setShowBaseline],
          ] as const
        ).map(([label, checked, onCheckedChange]) => (
          <div key={label} className="flex items-center gap-2">
            <Switch
              id={`toggle-${label}`}
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(value)}
            />
            <Label htmlFor={`toggle-${label}`} className="font-normal">
              {label}
            </Label>
          </div>
        ))}
      </div>

      {glyph.isComposite ? (
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {glyph.components.map((component, index) => (
                <li
                  key={`${component.glyphId}-${index}`}
                  className="flex flex-wrap items-center gap-3 text-sm"
                >
                  <Badge variant="secondary">{index + 1}</Badge>
                  <span className="font-mono text-xs">
                    {componentNames(component.glyphId) ??
                      `Glyph ${component.glyphId}`}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    glyph {component.glyphId}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    offset ({formatNumber(component.x)},{" "}
                    {formatNumber(component.y)})
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    transform [
                    {component.transform
                      .map((value) => value.toFixed(2))
                      .join(", ")}
                    ]
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
