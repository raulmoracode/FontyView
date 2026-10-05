import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { CoverageSummary } from "@/lib/font/coverage";
import { KNOWN_SCRIPTS } from "@/lib/font/unicode-data";
import { formatNumber } from "@/lib/format";

type ScriptRow = {
  script: string;
  characterCount: number;
  blocks: string[];
  covered: number;
  total: number;
  ratio: number;
};

export function Scripts({ coverage }: { coverage: CoverageSummary }) {
  const rows: ScriptRow[] = KNOWN_SCRIPTS.map((script) => {
    const blocks = coverage.blocks.filter(
      (entry) => entry.block.script === script,
    );
    const characterCount = blocks.reduce(
      (sum, entry) => sum + entry.covered,
      0,
    );
    const total = blocks.reduce((sum, entry) => sum + entry.total, 0);
    return {
      script,
      characterCount,
      blocks: blocks.map((entry) => entry.block.name),
      covered: blocks.reduce((sum, entry) => sum + entry.covered, 0),
      total,
      ratio: total > 0 ? characterCount / total : 0,
    };
  }).sort((a, b) => b.characterCount - a.characterCount);

  const supported = rows.filter((row) => row.characterCount > 0);
  const unsupported = rows.filter((row) => row.characterCount === 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          SCRIPTS
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {supported.length} of {rows.length} supported
          </Badge>
          <Badge variant="outline">
            {formatNumber(coverage.totalCodepoints)} characters
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Supported scripts</CardTitle>
        </CardHeader>
        <CardContent>
          {supported.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This font maps characters in no recognised script block.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {supported.map((row) => (
                <li key={row.script} className="flex items-start gap-3">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{row.script}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatNumber(row.characterCount)} characters
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {row.blocks.join(", ")}
                    </div>
                    <div className="mt-1.5 h-1 w-full max-w-sm overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-foreground/70"
                        style={{
                          width: `${Math.min(100, row.ratio * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {unsupported.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Not supported</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
              {unsupported.map((row) => (
                <li
                  key={row.script}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <X aria-hidden="true" className="size-3.5 shrink-0" />
                  {row.script}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Coverage per script</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {supported.map((row) => (
                <TableRow key={row.script}>
                  <TableCell className="w-40">{row.script}</TableCell>
                  <TableCell className="w-40 font-mono text-sm tabular-nums">
                    {formatNumber(row.covered)} / {formatNumber(row.total)}
                  </TableCell>
                  <TableCell className="w-20 font-mono text-sm tabular-nums">
                    {(row.ratio * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.blocks.join(", ")}
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
