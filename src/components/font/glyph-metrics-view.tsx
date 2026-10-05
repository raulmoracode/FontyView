import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { GlyphEntry } from "@/lib/font/glyphs";
import { formatMetric, formatNumber } from "@/lib/format";

type Bucket = {
  label: string;
  count: number;
};

function buildBuckets(
  values: number[],
  minimum: number,
  maximum: number,
): Bucket[] {
  const bucketCount = 12;
  const size = Math.max(1, Math.ceil((maximum - minimum) / bucketCount));
  const buckets: Bucket[] = [];

  for (let start = minimum; start <= maximum; start += size) {
    buckets.push({
      label: `${start}–${Math.min(start + size - 1, maximum)}`,
      count: 0,
    });
  }

  for (const value of values) {
    const index = Math.min(
      buckets.length - 1,
      Math.floor((value - minimum) / size),
    );
    buckets[index].count++;
  }

  return buckets;
}

export function GlyphMetricsView({ glyphs }: { glyphs: GlyphEntry[] }) {
  const stats = useMemo(() => {
    const advances = glyphs
      .map((glyph) => glyph.advanceWidth)
      .filter((value): value is number => value !== null);
    if (advances.length === 0) return null;

    const sorted = [...advances].sort((a, b) => a - b);
    const minimum = sorted[0];
    const maximum = sorted[sorted.length - 1];
    const total = advances.reduce((sum, value) => sum + value, 0);
    const buckets =
      maximum > minimum
        ? buildBuckets(advances, minimum, maximum)
        : [{ label: `${minimum}`, count: advances.length }];

    return {
      count: advances.length,
      minimum,
      maximum,
      average: Math.round(total / advances.length),
      median: sorted[Math.floor(sorted.length / 2)],
      buckets,
      peak: Math.max(...buckets.map((bucket) => bucket.count), 0),
    };
  }, [glyphs]);

  if (stats === null) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            GLYPH METRICS
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font provides no horizontal metrics, so no advance widths can
              be reported.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          GLYPH METRICS
        </h2>
        <Badge variant="secondary">{formatNumber(stats.count)} measured</Badge>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Minimum advance", stats.minimum],
            ["Maximum advance", stats.maximum],
            ["Average advance", stats.average],
            ["Median advance", stats.median],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl tabular-nums">
                {formatNumber(value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Advance width distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1">
            {stats.buckets.map((bucket) => (
              <li key={bucket.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                  {bucket.label}
                </span>
                <span className="h-4 flex-1 overflow-hidden rounded-sm bg-border">
                  <span
                    className="block h-full bg-foreground/60"
                    style={{ width: `${(bucket.count / stats.peak) * 100}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">
                  {formatNumber(bucket.count)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Widest glyphs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {[...glyphs]
                .filter((glyph) => glyph.advanceWidth !== null)
                .sort((a, b) => (b.advanceWidth ?? 0) - (a.advanceWidth ?? 0))
                .slice(0, 12)
                .map((glyph) => (
                  <TableRow key={glyph.glyphId}>
                    <TableCell className="w-16 font-mono text-sm">
                      {glyph.char ?? "—"}
                    </TableCell>
                    <TableCell className="w-24 font-mono text-sm tabular-nums">
                      {formatNumber(glyph.advanceWidth)}
                    </TableCell>
                    <TableCell className="w-28 font-mono text-sm tabular-nums">
                      {formatMetric(glyph.leftSideBearing)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {glyph.name ?? `gid ${glyph.glyphId}`}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
