import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Ligature } from "@/lib/font/tables/layout";
import { formatNumber } from "@/lib/format";

type GlyphOutline = {
  path: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

type Props = {
  /** Every ligature found in the font's GSUB lookups. */
  ligatures: Ligature[];
  /** Lookup indices that come from an extension lookup. */
  extendedLookups: Set<number>;
  /** Feature tags pointing at each lookup index. */
  featuresByLookup: Map<number, string[]>;
  glyphNames: Map<number, string>;
  codepoints: Map<number, number>;
  outlines: (glyphId: number) => GlyphOutline | null;
  hasGsub: boolean;
};

type Row = {
  glyphId: number;
  components: number[];
  lookupIndex: number;
  name: string | null;
  char: string | null;
  features: string[];
};

/** Draws one glyph to scale, so a ligature reads as a sequence of shapes. */
function Glyph({
  outline,
  label,
}: {
  outline: GlyphOutline | null;
  label: string;
}) {
  if (!outline) {
    return (
      <div
        role="img"
        aria-label={`${label}, no outline available`}
        className="flex h-14 w-14 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground"
      >
        n/a
      </div>
    );
  }

  const width = outline.xMax - outline.xMin || 1;
  const height = outline.yMax - outline.yMin || 1;
  const padding = Math.max(width, height) * 0.1;

  return (
    <svg
      viewBox={`${outline.xMin - padding} ${-outline.yMax - padding} ${width + padding * 2} ${height + padding * 2}`}
      className="h-14 w-14"
      role="img"
      aria-label={label}
    >
      <path
        d={outline.path}
        transform="scale(1, -1)"
        fill="currentColor"
        fillOpacity="0.75"
      />
    </svg>
  );
}

export function LigaturesView({
  ligatures,
  extendedLookups,
  featuresByLookup,
  glyphNames,
  codepoints,
  outlines,
  hasGsub,
}: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const ligature of ligatures) {
      const codepoint = codepoints.get(ligature.glyphId);
      out.push({
        glyphId: ligature.glyphId,
        components: ligature.components,
        lookupIndex: ligature.lookupIndex,
        name: glyphNames.get(ligature.glyphId) ?? null,
        char: codepoint === undefined ? null : String.fromCodePoint(codepoint),
        features: featuresByLookup.get(ligature.lookupIndex) ?? [],
      });
    }
    // Longest first: the multi-glyph sequences are the interesting ones.
    return out.sort((a, b) => b.components.length - a.components.length);
  }, [ligatures, featuresByLookup, glyphNames, codepoints]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return rows;
    return rows.filter(
      (row) =>
        row.name?.toLowerCase().includes(needle) ||
        row.char?.toLowerCase().includes(needle) ||
        row.features.some((tag) => tag.toLowerCase().includes(needle)) ||
        String(row.glyphId) === needle,
    );
  }, [rows, query]);

  if (!hasGsub) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            LIGATURES
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font has no <span className="font-mono">GSUB</span> table, so
              it defines no substitutions at all, ligatures included.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (ligatures.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            LIGATURES
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font has a <span className="font-mono">GSUB</span> table but
              no ligature substitution lookups, so it builds no ligatures. It
              may still apply other substitutions, such as single or contextual
              ones.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const distinctLookups = new Set(rows.map((row) => row.lookupIndex)).size;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          LIGATURES
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {formatNumber(distinctLookups)}{" "}
            {distinctLookups === 1 ? "lookup" : "lookups"}
          </Badge>
          <Badge variant="outline">
            {formatNumber(ligatures.length)} ligatures
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="ligature-search">Name, character or feature</Label>
          <Input
            id="ligature-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="fi, liga, f_i"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Components</TableHead>
                <TableHead className="w-10" />
                <TableHead>Result</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead>Lookup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={`${row.lookupIndex}-${row.glyphId}-${row.components.join("-")}`}
                >
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {row.components.map((glyphId, index) => (
                        <Glyph
                          key={`${glyphId}-${index}`}
                          outline={outlines(glyphId)}
                          label={`Component ${index + 1}, glyph ${glyphId}`}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </TableCell>
                  <TableCell>
                    <Glyph
                      outline={outlines(row.glyphId)}
                      label={`Ligature glyph ${row.glyphId}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.name ?? `gid ${row.glyphId}`}
                    {row.char ? (
                      <span className="ml-2 text-muted-foreground">
                        {row.char}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.features.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Unreferenced
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.features.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.lookupIndex}
                    {extendedLookups.has(row.lookupIndex) ? (
                      <span className="ml-1 text-muted-foreground">(ext)</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No ligature matches that search.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
