import { Plus, X } from "lucide-react";
import { useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoadedFont } from "@/lib/font/analyze";
import {
  type Comparison,
  compareFonts,
  comparisonGroups,
  formatComparisonValue,
  rowsInGroup,
} from "@/lib/font/compare";
import { formatNumber } from "@/lib/format";
import { useFontStore } from "@/store/font-store";

const SAMPLE_TEXT = "Handgloves 0123456789";

export function FontComparison({
  primary,
  compared,
}: {
  primary: LoadedFont;
  compared: LoadedFont | null;
}) {
  const comparedStatus = useFontStore((state) => state.comparedStatus);
  const comparedError = useFontStore((state) => state.comparedError);
  const comparedFileName = useFontStore((state) => state.comparedFileName);
  const loadComparedFont = useFontStore((state) => state.loadComparedFont);
  const clearComparedFont = useFontStore((state) => state.clearComparedFont);
  const inputRef = useRef<HTMLInputElement>(null);

  const comparison = useMemo(
    () => (compared ? compareFonts(primary, compared) : null),
    [primary, compared],
  );

  const nameOf = (font: LoadedFont) =>
    font.analysis.metadata.familyName ?? font.analysis.file.fileName;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          COMPARE
        </h2>
        {comparison ? (
          <Badge variant="secondary">
            {formatNumber(comparison.differing)} of{" "}
            {formatNumber(comparison.rows.length)} values differ
          </Badge>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Second font</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {compared ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{nameOf(compared)}</Badge>
              <span className="text-sm text-muted-foreground">
                {compared.analysis.file.fileName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearComparedFont()}
              >
                <X aria-hidden="true" />
                Remove
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Load a second font to compare it against {nameOf(primary)}. Both
              stay in your browser.
            </p>
          )}

          <div>
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={comparedStatus === "analyzing"}
            >
              <Plus aria-hidden="true" />
              {comparedStatus === "analyzing"
                ? "Reading font"
                : compared
                  ? "Replace"
                  : "Choose a font"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept=".ttf,.otf,.woff,.woff2,.ttc,.otc"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void loadComparedFont(file);
              }}
            />
          </div>

          {comparedError ? (
            <p className="text-sm text-destructive">
              {comparedError.title}: {comparedError.body}
            </p>
          ) : null}
          {comparedStatus === "analyzing" ? (
            <p className="text-sm text-muted-foreground">
              Reading {comparedFileName}…
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!compared || !comparison ? null : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Same text, both fonts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(
                [
                  ["primary", primary],
                  ["compared", compared],
                ] as const
              ).map(([which, font]) => (
                <div key={which} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {nameOf(font)}
                  </span>
                  <p
                    className="text-3xl break-words"
                    style={{
                      fontFamily: `"${font.analysis.cssFamilyName}", monospace`,
                    }}
                  >
                    {SAMPLE_TEXT}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <ComparisonTable comparison={comparison} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature tags</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {comparison.features.shared.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">
                    Both
                  </span>
                  {comparison.features.shared.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {comparison.features.onlyLeft.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">
                    {nameOf(primary)} only
                  </span>
                  {comparison.features.onlyLeft.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {comparison.features.onlyRight.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">
                    {nameOf(compared)} only
                  </span>
                  {comparison.features.onlyRight.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {comparison.features.shared.length === 0 &&
              comparison.features.onlyLeft.length === 0 &&
              comparison.features.onlyRight.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Neither font applies OpenType features.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Table differences</CardTitle>
            </CardHeader>
            <CardContent>
              {comparison.tables.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Both fonts contain the same tables at the same sizes.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>{nameOf(primary)}</TableHead>
                      <TableHead>{nameOf(compared)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.tables.map((table) => (
                      <TableRow key={table.tag}>
                        <TableCell className="font-mono text-xs">
                          {table.tag}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {table.left === null
                            ? "Absent"
                            : formatNumber(table.left)}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {table.right === null
                            ? "Absent"
                            : formatNumber(table.right)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ComparisonTable({ comparison }: { comparison: Comparison }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Value</TableHead>
          <TableHead>First</TableHead>
          <TableHead>Second</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {comparisonGroups(comparison).map((group) => (
          <ComparisonGroup key={group} group={group} comparison={comparison} />
        ))}
      </TableBody>
    </Table>
  );
}

function ComparisonGroup({
  group,
  comparison,
}: {
  group: string;
  comparison: Comparison;
}) {
  const rows = rowsInGroup(comparison, group);

  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell
          colSpan={3}
          className="bg-muted/40 text-xs font-semibold tracking-wide uppercase"
        >
          {group}
        </TableCell>
      </TableRow>
      {rows.map((row) => (
        <TableRow key={row.label}>
          <TableCell className="text-muted-foreground">{row.label}</TableCell>
          <TableCell
            className={
              row.differs
                ? "font-mono text-sm tabular-nums"
                : "font-mono text-sm tabular-nums text-muted-foreground"
            }
          >
            {formatComparisonValue(row.left, row.right)}
          </TableCell>
          <TableCell
            className={
              row.differs
                ? "font-mono text-sm tabular-nums"
                : "font-mono text-sm tabular-nums text-muted-foreground"
            }
          >
            {formatComparisonValue(row.right, row.left)}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
