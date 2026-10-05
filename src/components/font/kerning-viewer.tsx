import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { KerningData } from "@/lib/font/tables/kerning";
import { formatNumber } from "@/lib/format";

/** Pairs a designer looks for first, shown as a starting point. */
const NOTABLE_PAIRS = [
  "AV",
  "AW",
  "AY",
  "AT",
  "Av",
  "Aw",
  "Ay",
  "LT",
  "LY",
  "To",
  "Ta",
  "Te",
  "Tr",
  "Tu",
  "Tw",
  "Ty",
  "Va",
  "Ve",
  "Vo",
  "Wa",
  "We",
  "Wo",
  "Ya",
  "Ye",
  "Yo",
  "rt",
  "ry",
  "ff",
  "fi",
  "fl",
];

type PairRow = {
  left: number;
  right: number;
  value: number;
  leftChar: string | null;
  rightChar: string | null;
};

/** The character a glyph encodes, so a pair can be shown as "AV" not "36 37". */
function charFor(
  glyphId: number,
  codepoints: Map<number, number>,
): string | null {
  const codepoint = codepoints.get(glyphId);
  if (codepoint === undefined) return null;
  try {
    return String.fromCodePoint(codepoint);
  } catch {
    return null;
  }
}

export function KerningViewer({
  kerning,
  family,
  codepointToGlyph,
  glyphToCodepoint,
  glyphNames,
}: {
  kerning: KerningData;
  family: string;
  /** The font's own cmap: code point to glyph ID. */
  codepointToGlyph: Map<number, number>;
  /** The same mapping inverted, for labelling a glyph ID as a character. */
  glyphToCodepoint: Map<number, number>;
  /** `post` glyph names, when the font provides them. */
  glyphNames: Map<number, string>;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(300);

  const rows = useMemo<PairRow[]>(() => {
    const out: PairRow[] = [];
    for (const pair of kerning.pairs.values()) {
      out.push({
        left: pair.left,
        right: pair.right,
        value: pair.value,
        leftChar: charFor(pair.left, glyphToCodepoint),
        rightChar: charFor(pair.right, glyphToCodepoint),
      });
    }
    return out.sort((a, b) => a.value - b.value);
  }, [kerning.pairs, glyphToCodepoint]);

  const queryCodepoints = useMemo(
    () => [...query].map((char) => char.codePointAt(0) ?? 0),
    [query],
  );

  const customPair = useMemo(() => {
    if (queryCodepoints.length !== 2) return null;
    const [first, second] = queryCodepoints;
    const left = codepointToGlyph.get(first ?? -1);
    const right = codepointToGlyph.get(second ?? -1);
    if (left === undefined || right === undefined) {
      return { available: false as const };
    }
    const found = kerning.pairs.get((left ?? 0) * 65536 + (right ?? 0));
    return {
      available: true as const,
      left,
      right,
      value: found?.value ?? 0,
      defined: found !== undefined,
    };
  }, [queryCodepoints, codepointToGlyph, kerning.pairs]);

  const notable = useMemo(
    () =>
      NOTABLE_PAIRS.map((text) => {
        const [first, second] = [...text].map(
          (char) => char.codePointAt(0) ?? 0,
        );
        const left = codepointToGlyph.get(first);
        const right = codepointToGlyph.get(second);
        if (left === undefined || right === undefined) return null;
        const found = kerning.pairs.get(left * 65536 + right);
        return { text, value: found?.value ?? null };
      }).filter(
        (row): row is { text: string; value: number | null } => row !== null,
      ),
    [codepointToGlyph, kerning.pairs],
  );

  if (kerning.pairs.size === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            KERNING
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font contains no kerning data. There is no legacy{" "}
              <span className="font-mono">kern</span> table and no GPOS pair
              positioning, so no pair is adjusted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visible = rows.slice(0, limit);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          KERNING
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {kerning.sources.map((source) => (
            <Badge key={source} variant="secondary">
              {source} · {formatNumber(kerning.counts[source])} pairs
            </Badge>
          ))}
          <Badge variant="outline">
            {formatNumber(kerning.pairs.size)} distinct pairs
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Look up a pair</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kern-pair">Enter pair</Label>
            <div className="flex items-center gap-3">
              <Input
                id="kern-pair"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="AV"
                maxLength={2}
                className="w-24 text-center font-mono text-lg"
                style={{ fontFamily: `"${family}", monospace` }}
              />
              {customPair === null ? (
                <span className="text-sm text-muted-foreground">
                  Enter two characters.
                </span>
              ) : customPair.available ? (
                <span className="font-mono text-sm">
                  {customPair.defined ? (
                    <>
                      {formatNumber(customPair.value)} units
                      <span className="ml-2 text-muted-foreground">
                        (glyphs {customPair.left} → {customPair.right})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No kerning pair defined
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  One of these characters is not in the font.
                </span>
              )}
            </div>
          </div>

          {customPair?.available ? (
            <div className="flex flex-wrap items-center gap-6 rounded-md border border-border bg-muted/30 p-4 text-2xl">
              <span style={{ fontFamily: `"${family}", monospace` }}>
                {query || " "}
              </span>
              <span style={{ fontFamily: `"${family}", monospace` }}>
                {query || " "}
              </span>
              <span className="text-sm text-muted-foreground">
                {customPair.defined
                  ? `${formatNumber(customPair.value)} units applied`
                  : "No adjustment"}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {notable.some((row) => row.value !== null) ? (
        <Card>
          <CardHeader>
            <CardTitle>Notable pairs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {notable.map((row) => (
                <li key={row.text}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={() => setQuery(row.text)}
                  >
                    <span style={{ fontFamily: `"${family}", monospace` }}>
                      {row.text}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {row.value === null ? "—" : formatNumber(row.value)}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Search aria-hidden="true" className="size-4" />
            All pairs
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Showing {formatNumber(Math.min(limit, rows.length))} of{" "}
            {formatNumber(rows.length)}, most negative first
          </span>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={`${row.left}-${row.right}`}>
                  <TableCell
                    className="w-24 text-center text-xl"
                    style={{ fontFamily: `"${family}", monospace` }}
                  >
                    {row.leftChar ?? glyphNames.get(row.left) ?? "?"}
                  </TableCell>
                  <TableCell
                    className="w-24 text-center text-xl"
                    style={{ fontFamily: `"${family}", monospace` }}
                  >
                    {row.rightChar ?? glyphNames.get(row.right) ?? "?"}
                  </TableCell>
                  <TableCell className="w-20 font-mono text-sm tabular-nums">
                    {formatNumber(row.value)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.left} → {row.right}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {visible.length < rows.length ? (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit(limit * 2)}
              >
                Show more
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
