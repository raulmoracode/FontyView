import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CoverageSummary } from "@/lib/font/coverage";
import { formatCodepoint } from "@/lib/font/unicode-data";
import { formatNumber, orUnavailable } from "@/lib/format";

/** A single cell in the character map. */
function CharacterCell({
  codepoint,
  family,
}: {
  codepoint: number;
  family: string;
}) {
  const char = String.fromCodePoint(codepoint);
  const isUnprintable =
    codepoint < 0x20 ||
    (codepoint >= 0x7f && codepoint <= 0xa0) ||
    codepoint === 0xad ||
    (codepoint >= 0x200b && codepoint <= 0x200f) ||
    codepoint === 0xfeff;

  return (
    <div className="group flex flex-col items-center gap-1">
      <div
        className="flex h-11 w-11 items-center justify-center rounded border border-border text-lg"
        style={{ fontFamily: `"${family}", monospace` }}
        title={`${char} · ${formatCodepoint(codepoint)}`}
      >
        {isUnprintable ? (
          <span
            aria-hidden="true"
            className="font-mono text-[10px] text-muted-foreground"
          >
            {codepoint.toString(16).toUpperCase().padStart(2, "0")}
          </span>
        ) : (
          char
        )}
      </div>
      <span className="font-mono text-[9px] text-muted-foreground">
        {codepoint.toString(16).toUpperCase().padStart(4, "0")}
      </span>
    </div>
  );
}

/**
 * Matches a code point against what the user typed: the character itself, or
 * its code point written in hex or decimal, with or without a `U+` prefix and
 * with or without zero padding.
 */
function matchesCodepoint(codepoint: number, needle: string): boolean {
  if (String.fromCodePoint(codepoint).toLowerCase() === needle) return true;

  const cleaned = needle
    .replace(/^u\+/, "")
    .replace(/^0x/, "")
    .replace(/^0+/, "")
    .trim();
  if (cleaned.length === 0) return false;

  const hex = codepoint.toString(16);
  const decimal = codepoint.toString(10);
  return hex === cleaned || decimal === cleaned || hex.startsWith(cleaned);
}

export function CharacterMap({
  coverage,
  family,
}: {
  coverage: CoverageSummary;
  family: string;
}) {
  const [query, setQuery] = useState("");
  const [blockFilter, setBlockFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return coverage.blocks
      .filter(
        (entry) => blockFilter === "all" || entry.block.name === blockFilter,
      )
      .map((entry) => ({
        ...entry,
        codepoints: needle
          ? entry.codepoints.filter((codepoint) =>
              matchesCodepoint(codepoint, needle),
            )
          : entry.codepoints,
      }))
      .filter((entry) => entry.codepoints.length > 0);
  }, [coverage.blocks, query, blockFilter]);

  const shown = filtered.reduce(
    (sum, entry) => sum + entry.codepoints.length,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          CHARACTER MAP
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatNumber(shown)} characters</Badge>
          <Badge variant="outline">
            {formatNumber(filtered.length)} blocks
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="charmap-search">Search characters</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="charmap-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="a, 0041, U+0041..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="charmap-block">Block</Label>
          <Select value={blockFilter} onValueChange={setBlockFilter}>
            <SelectTrigger id="charmap-block" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All blocks ({formatNumber(coverage.blocks.length)})
              </SelectItem>
              {coverage.blocks.map((entry) => (
                <SelectItem key={entry.block.name} value={entry.block.name}>
                  {entry.block.name} ({formatNumber(entry.covered)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {orUnavailable(
                coverage.totalCodepoints > 0
                  ? "No character in this font matches that search."
                  : "This font maps no characters.",
              )}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {filtered.map((entry) => (
        <Card key={entry.block.name}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {entry.block.name}
              {entry.block.script ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {entry.block.script}
                </span>
              ) : null}
            </CardTitle>
            <span className="font-mono text-xs text-muted-foreground">
              {formatNumber(entry.codepoints.length)} shown ·{" "}
              {formatCodepoint(entry.block.start)}–
              {formatCodepoint(entry.block.end)}
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {entry.codepoints.map((codepoint) => (
                <CharacterCell
                  key={codepoint}
                  codepoint={codepoint}
                  family={family}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
