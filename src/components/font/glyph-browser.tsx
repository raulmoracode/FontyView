import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useElementWidth } from "@/hooks/use-element-width";
import { useVirtualWindow } from "@/hooks/use-virtual-window";
import {
  availableCategories,
  availableScripts,
  type CategoryFilter,
  categoryOf,
  filterGlyphs,
  type GlyphQuery,
  type SortKey,
} from "@/lib/font/glyph-query";
import type { GlyphEntry } from "@/lib/font/glyphs";
import { CATEGORY_LABELS } from "@/lib/font/unicode-category";
import { formatCodepoint } from "@/lib/font/unicode-data";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const CELL_WIDTH = 96;
const CELL_HEIGHT = 104;
const GAP = 4;
const VIEWPORT_HEIGHT = 640;

const SORTS: { value: SortKey; label: string }[] = [
  { value: "unicode", label: "Unicode" },
  { value: "glyphId", label: "Glyph ID" },
  { value: "name", label: "Name" },
  { value: "advanceWidth", label: "Advance width" },
];

type Props = {
  glyphs: GlyphEntry[];
  family: string;
  scriptOf: (glyph: GlyphEntry) => string | undefined;
  selectedGlyphId?: number | null;
  onSelect?: (glyph: GlyphEntry) => void;
  /** Rendered beside the grid, typically the detail panel. */
  detail?: React.ReactNode;
};

export function GlyphBrowser(props: Props) {
  const detail = props.detail;
  if (!detail) return <GlyphGridPane {...props} />;

  return (
    <div className="flex flex-col gap-6 xl:flex-row-reverse">
      <div className="xl:w-80 xl:shrink-0">
        <div className="xl:sticky xl:top-4">{detail}</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <GlyphGridPane {...props} />
      </div>
    </div>
  );
}

function GlyphGridPane({
  glyphs,
  family,
  scriptOf,
  selectedGlyphId,
  onSelect,
}: Props) {
  const [query, setQuery] = useState<GlyphQuery>({
    search: "",
    category: "all",
    script: "all",
    sort: "unicode",
    direction: "asc",
  });

  const { ref, width } = useElementWidth<HTMLDivElement>();
  const columns = Math.max(1, Math.floor(width / CELL_WIDTH) || 1);

  const categories = useMemo(() => availableCategories(glyphs), [glyphs]);
  const scripts = useMemo(
    () => availableScripts(glyphs, scriptOf),
    [glyphs, scriptOf],
  );
  const visible = useMemo(
    () => filterGlyphs(glyphs, query, scriptOf),
    [glyphs, query, scriptOf],
  );

  const rowCount = Math.ceil(visible.length / columns);
  const {
    startIndex: startRow,
    endIndex: endRow,
    paddingTop,
    paddingBottom,
    onScroll,
    scrollRef,
  } = useVirtualWindow({
    itemCount: rowCount,
    itemHeight: CELL_HEIGHT + GAP,
    viewportHeight: VIEWPORT_HEIGHT,
    overscan: 2,
  });

  const windowed = useMemo(
    () =>
      visible.slice(
        startRow * columns,
        Math.min(visible.length, endRow * columns),
      ),
    [visible, startRow, endRow, columns],
  );

  const isFiltered =
    query.search !== "" || query.category !== "all" || query.script !== "all";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          GLYPHS
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {isFiltered
              ? `${formatNumber(visible.length)} of ${formatNumber(glyphs.length)}`
              : `${formatNumber(glyphs.length)} glyphs`}
          </Badge>
          <Badge variant="outline">{formatNumber(columns)} columns</Badge>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="glyph-search">Search glyphs</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="glyph-search"
              value={query.search}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="A, alpha, Euro, U+20AC, 36"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="glyph-sort">Sort by</Label>
          <div className="flex gap-2">
            <Select
              value={query.sort}
              onValueChange={(value) =>
                setQuery((current) => ({
                  ...current,
                  sort: value as SortKey,
                }))
              }
            >
              <SelectTrigger id="glyph-sort" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((sort) => (
                  <SelectItem key={sort.value} value={sort.value}>
                    {sort.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label={
                query.direction === "asc" ? "Sort descending" : "Sort ascending"
              }
              onClick={() =>
                setQuery((current) => ({
                  ...current,
                  direction: current.direction === "asc" ? "desc" : "asc",
                }))
              }
            >
              {query.direction === "asc" ? (
                <ArrowDownAZ aria-hidden="true" />
              ) : (
                <ArrowUpAZ aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="glyph-script">Script</Label>
          <Select
            value={query.script}
            onValueChange={(value) =>
              setQuery((current) => ({ ...current, script: value }))
            }
          >
            <SelectTrigger id="glyph-script" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scripts</SelectItem>
              {scripts.map((entry) => (
                <SelectItem key={entry.script} value={entry.script}>
                  {entry.script} ({formatNumber(entry.count)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-1.5 py-3">
          <FilterChip
            label="All"
            count={glyphs.length}
            isActive={query.category === "all"}
            onSelect={() =>
              setQuery((current) => ({ ...current, category: "all" }))
            }
          />
          {categories.map((entry) => (
            <FilterChip
              key={entry.category}
              label={CATEGORY_LABELS[entry.category]}
              count={entry.count}
              isActive={query.category === entry.category}
              onSelect={() =>
                setQuery((current) => ({
                  ...current,
                  category: entry.category as CategoryFilter,
                }))
              }
            />
          ))}
        </CardContent>
      </Card>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-y-auto rounded-md border border-border"
        style={{ height: VIEWPORT_HEIGHT }}
      >
        <div style={{ height: paddingTop }} aria-hidden="true" />

        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No glyph matches these filters.
          </p>
        ) : (
          <div
            ref={ref}
            className="grid gap-1 p-1"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {windowed.map((glyph) => (
              <GlyphCell
                key={glyph.glyphId}
                glyph={glyph}
                family={family}
                isSelected={glyph.glyphId === selectedGlyphId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        <div style={{ height: paddingBottom }} aria-hidden="true" />
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  isActive,
  onSelect,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "border-foreground bg-accent font-medium text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {label}
      <span className="ml-1.5 font-mono opacity-70">{formatNumber(count)}</span>
    </button>
  );
}

function GlyphCell({
  glyph,
  family,
  isSelected,
  onSelect,
}: {
  glyph: GlyphEntry;
  family: string;
  isSelected: boolean;
  onSelect?: (glyph: GlyphEntry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(glyph)}
      aria-label={`Glyph ${glyph.glyphId}${glyph.char ? `, ${glyph.char}` : ""}`}
      aria-pressed={isSelected}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded border p-1 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "border-foreground bg-accent"
          : "border-transparent hover:border-border hover:bg-accent/40",
      )}
      style={{ height: CELL_HEIGHT }}
    >
      <span
        className="flex h-16 w-full items-center justify-center overflow-hidden text-2xl leading-none"
        style={{ fontFamily: `"${family}", monospace` }}
      >
        {glyph.char ?? (
          <span
            aria-hidden="true"
            className="font-mono text-xs text-muted-foreground/60"
          >
            g{glyph.glyphId}
          </span>
        )}
      </span>
      <span className="font-mono text-[9px] leading-tight text-muted-foreground">
        {glyph.codepoint === null
          ? `gid ${glyph.glyphId}`
          : formatCodepoint(glyph.codepoint)}
      </span>
      <span className="sr-only">
        {glyph.name ? `Named ${glyph.name}. ` : ""}
        Category {CATEGORY_LABELS[categoryOf(glyph)]}. Advance width{" "}
        {glyph.advanceWidth ?? "unknown"}.
      </span>
    </button>
  );
}
