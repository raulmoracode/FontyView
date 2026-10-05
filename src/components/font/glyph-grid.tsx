import { useMemo } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { useVirtualWindow } from "@/hooks/use-virtual-window";
import type { GlyphEntry } from "@/lib/font/glyphs";
import { formatCodepoint } from "@/lib/font/unicode-data";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const CELL_WIDTH = 96;
const CELL_HEIGHT = 104;
const GAP = 4;
const VIEWPORT_HEIGHT = 640;

type Props = {
  glyphs: GlyphEntry[];
  family: string;
  onSelect?: (glyph: GlyphEntry) => void;
  selectedGlyphId?: number | null;
};

/**
 * Windowed glyph grid.
 *
 * Only the rows in view are mounted, so a font with 50,000 glyphs costs the
 * same to scroll as one with 50. The count in the header is always the real
 * total, never the number currently rendered.
 */
export function GlyphGrid({
  glyphs,
  family,
  onSelect,
  selectedGlyphId,
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const columns = Math.max(1, Math.floor(width / CELL_WIDTH) || 1);
  const rowCount = Math.ceil(glyphs.length / columns);

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

  const visible = useMemo(() => {
    const from = startRow * columns;
    const to = Math.min(glyphs.length, endRow * columns);
    return glyphs.slice(from, to);
  }, [glyphs, startRow, endRow, columns]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          GLYPHS
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {formatNumber(glyphs.length)} glyphs · {formatNumber(columns)} columns
        </span>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-y-auto rounded-md border border-border"
        style={{ height: VIEWPORT_HEIGHT }}
      >
        <div style={{ height: paddingTop }} aria-hidden="true" />

        <div
          ref={ref}
          className="grid gap-1 p-1"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {visible.map((glyph) => (
            <GlyphCell
              key={glyph.glyphId}
              glyph={glyph}
              family={family}
              isSelected={glyph.glyphId === selectedGlyphId}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div style={{ height: paddingBottom }} aria-hidden="true" />
      </div>
    </div>
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
          ? "gid " + glyph.glyphId
          : formatCodepoint(glyph.codepoint)}
      </span>
      <span className="sr-only">
        {glyph.name ? `Named ${glyph.name}. ` : ""}
        Advance width {glyph.advanceWidth ?? "unknown"}.
      </span>
    </button>
  );
}
