import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { CoverageSummary } from "@/lib/font/coverage";
import { formatRatio } from "@/lib/font/coverage";
import { formatCodepoint } from "@/lib/font/unicode-data";
import { formatNumber, orUnavailable } from "@/lib/format";

function CoverageBar({ ratio }: { ratio: number }) {
  const percent = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-border"
      role="img"
      aria-label={`${formatRatio(ratio)} covered`}
    >
      <div
        className="h-full bg-foreground/70"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function UnicodeCoverage({ coverage }: { coverage: CoverageSummary }) {
  const [query, setQuery] = useState("");

  const blocks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return coverage.blocks;
    return coverage.blocks.filter(
      (entry) =>
        entry.block.name.toLowerCase().includes(needle) ||
        (entry.block.script?.toLowerCase().includes(needle) ?? false),
    );
  }, [coverage.blocks, query]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          UNICODE COVERAGE
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {formatNumber(coverage.totalCodepoints)} code points
          </Badge>
          <Badge variant="outline">
            {formatNumber(coverage.blocks.length)} blocks
          </Badge>
          <Badge variant="outline">
            {formatNumber(coverage.completeBlocks)} complete
          </Badge>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="coverage-search">Filter blocks</Label>
        <Input
          id="coverage-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Latin, Greek, Symbols..."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Blocks present in this font</CardTitle>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {coverage.blocks.length === 0
                ? "This font maps no code points to any known Unicode block."
                : "No block matches that filter."}
            </p>
          ) : (
            <Table>
              <TableBody>
                {blocks.map((entry) => (
                  <TableRow key={entry.block.name}>
                    <TableCell className="w-64 align-top">
                      <span className="block text-sm">{entry.block.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {formatCodepoint(entry.block.start)}–
                        {formatCodepoint(entry.block.end)}
                        {entry.block.script ? ` · ${entry.block.script}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="w-32 align-top font-mono text-sm tabular-nums">
                      {formatNumber(entry.covered)} /{" "}
                      {formatNumber(entry.total)}
                    </TableCell>
                    <TableCell className="w-20 align-top font-mono text-sm tabular-nums">
                      {formatRatio(entry.ratio)}
                    </TableCell>
                    <TableCell className="align-top">
                      <CoverageBar ratio={entry.ratio} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Range</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="w-64 text-muted-foreground">
                  Lowest code point
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {coverage.blocks.length > 0 && coverage.blocks[0]
                    ? formatCodepoint(coverage.blocks[0].block.start)
                    : "Not available"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">
                  Highest code point
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {coverage.highestCodepoint > 0
                    ? formatCodepoint(coverage.highestCodepoint)
                    : "Not available"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">
                  Unmapped code points in covered blocks
                </TableCell>
                <TableCell className="font-mono text-sm tabular-nums">
                  {formatNumber(
                    coverage.blocks.reduce(
                      (sum, entry) => sum + (entry.total - entry.covered),
                      0,
                    ),
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-muted-foreground">
            Coverage is counted from the font&apos;s own character map.{" "}
            {orUnavailable(
              coverage.totalCodepoints > 0
                ? `Only the blocks listed here are present; everything else is absent from this font.`
                : null,
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
