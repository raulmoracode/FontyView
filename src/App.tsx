import { useEffect, useMemo, useRef, useState } from "react";
import { CharacterMap } from "@/components/font/character-map";
import { ExportJsonCard } from "@/components/font/export-json-card";
import { ExportReportCard } from "@/components/font/export-report-card";
import { FontComparison } from "@/components/font/font-comparison";
import { FontInformation } from "@/components/font/font-information";
import { FontMetricsView } from "@/components/font/font-metrics";
import { GlyphBrowser } from "@/components/font/glyph-browser";
import {
  type GlyphDetail,
  GlyphDetailPanel,
} from "@/components/font/glyph-detail-panel";
import { GlyphMetricsView } from "@/components/font/glyph-metrics-view";
import { GlyphOutlineViewer } from "@/components/font/glyph-outline-viewer";
import { KerningViewer } from "@/components/font/kerning-viewer";
import { LigaturesView } from "@/components/font/ligatures-view";
import { OpenTypeFeatures } from "@/components/font/opentype-features";
import { OpenTypeTables } from "@/components/font/opentype-tables";
import { Overview } from "@/components/font/overview";
import { Scripts } from "@/components/font/scripts";
import { Specimen } from "@/components/font/specimen";
import { UnicodeCoverage } from "@/components/font/unicode-coverage";
import { VariableFontControls } from "@/components/font/variable-font-controls";
import { AppShell } from "@/components/layout/app-shell";
import type { SectionId } from "@/components/layout/app-sidebar";
import { AnalyzingScreen } from "@/components/upload/analyzing-screen";
import { UploadScreen } from "@/components/upload/upload-screen";
import {
  useComparedFontRegistration,
  useFontRegistration,
} from "@/hooks/use-font-registration";
import { buildCoverage, type CoverageSummary } from "@/lib/font/coverage";
import {
  createGlyphSource,
  readOutline,
  readRawGlyph,
} from "@/lib/font/font-source";
import { categoryOf } from "@/lib/font/glyph-query";
import { buildGlyphList, type GlyphEntry } from "@/lib/font/glyphs";
import { glyphToPath } from "@/lib/font/outline-path";
import { toVariationSettings } from "@/lib/font/tables/variations";
import { CATEGORY_LABELS } from "@/lib/font/unicode-category";
import { blockForCodepoint } from "@/lib/font/unicode-data";
import { useFontStore } from "@/store/font-store";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
        {title.toUpperCase()}
      </h2>
      <p className="text-sm text-muted-foreground">Coming in a later step.</p>
    </div>
  );
}

const SECTION_TITLES: Record<SectionId, string> = {
  overview: "Overview",
  information: "Font Information",
  specimen: "Specimen",
  glyphs: "Glyphs",
  "character-map": "Character Map",
  unicode: "Unicode Coverage",
  scripts: "Scripts",
  metrics: "Font Metrics",
  "glyph-metrics": "Glyph Metrics",
  tables: "OpenType Tables",
  features: "Features",
  kerning: "Kerning",
  ligatures: "Ligatures",
  variable: "Variable",
  compare: "Compare",
  export: "Export Report",
};

/** Inverts the cmap so a glyph ID can be shown as the character it encodes. */
function glyphToCodepoint(mapping: Map<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [codepoint, glyphId] of mapping) {
    if (!out.has(glyphId)) out.set(glyphId, codepoint);
  }
  return out;
}

type LoadedFontState = NonNullable<
  ReturnType<typeof useFontStore.getState>["loaded"]
>;

type ScriptLookup = (glyph: GlyphEntry) => string | undefined;

/** Builds the detail panel input for a glyph, or a placeholder when none is selected. */
function buildDetail(
  loaded: LoadedFontState,
  glyph: GlyphEntry | null,
): GlyphDetail {
  const unitsPerEm = loaded.structure.head?.unitsPerEm ?? null;
  const raw = glyph ? readRawGlyphFor(loaded, glyph.glyphId) : null;
  return {
    glyphId: glyph?.glyphId ?? 0,
    name: glyph?.name ?? null,
    raw,
    advanceWidth: glyph?.advanceWidth ?? null,
    leftSideBearing: glyph?.leftSideBearing ?? null,
    xMin: raw ? raw.xMin : null,
    yMin: raw ? raw.yMin : null,
    xMax: raw ? raw.xMax : null,
    yMax: raw ? raw.yMax : null,
    unitsPerEm,
  };
}

/** Raw `glyf` data is only available for TrueType-outline fonts. */
/**
 * Path data for a glyph, preferring the font's own `glyf` records because they
 * need no second parser, and falling back to opentype.js for CFF outlines.
 */
function outlineFor(loaded: LoadedFontState, glyphId: number) {
  const raw = readRawGlyphFor(loaded, glyphId);
  if (raw && !raw.isEmpty) {
    return {
      path: glyphToPath(raw, (id) => readRawGlyphFor(loaded, id)),
      xMin: raw.xMin,
      yMin: raw.yMin,
      xMax: raw.xMax,
      yMax: raw.yMax,
    };
  }

  const outline = readOutline(
    createGlyphSource(loaded.structure, loaded.font),
    glyphId,
  );
  return outline
    ? {
        path: outline.path,
        xMin: outline.xMin,
        yMin: outline.yMin,
        xMax: outline.xMax,
        yMax: outline.yMax,
      }
    : null;
}

function readRawGlyphFor(loaded: LoadedFontState, glyphId: number) {
  if (loaded.structure.loca === null) return null;
  const source = createGlyphSource(loaded.structure, loaded.font);
  return readRawGlyph(source, glyphId);
}

type AxisValues = Record<string, number>;

function renderSection(
  active: SectionId,
  loaded: LoadedFontState,
  coverage: CoverageSummary,
  glyphs: GlyphEntry[],
  scriptOf: ScriptLookup,
  selectedGlyphId: number | null,
  onSelectGlyph: (glyphId: number) => void,
  axisValues: AxisValues,
  onAxisChange: (next: AxisValues) => void,
  compared: LoadedFontState | null,
) {
  switch (active) {
    case "overview":
      return <Overview analysis={loaded.analysis} />;
    case "information":
      return <FontInformation records={loaded.structure.names} />;
    case "tables":
      return <OpenTypeTables analysis={loaded.analysis} />;
    case "metrics":
      return <FontMetricsView structure={loaded.structure} />;
    case "glyph-metrics":
      return <GlyphMetricsView glyphs={glyphs} />;
    case "specimen":
      return (
        <Specimen
          family={loaded.analysis.cssFamilyName}
          layout={loaded.structure.layout}
          variationSettings={toVariationSettings(
            loaded.structure.variation.axes,
            axisValues,
          )}
        />
      );
    case "variable":
      return (
        <VariableFontControls
          variation={loaded.structure.variation}
          family={loaded.analysis.cssFamilyName}
          values={axisValues}
          onChange={onAxisChange}
        />
      );
    case "features":
      return <OpenTypeFeatures layout={loaded.structure.layout} />;
    case "glyphs": {
      const selected = glyphs.find(
        (glyph) => glyph.glyphId === selectedGlyphId,
      );
      return (
        <GlyphBrowser
          glyphs={glyphs}
          family={loaded.analysis.cssFamilyName}
          scriptOf={scriptOf}
          selectedGlyphId={selectedGlyphId}
          onSelect={(glyph) => onSelectGlyph(glyph.glyphId)}
          detail={
            <div className="flex flex-col gap-6">
              <GlyphDetailPanel
                detail={buildDetail(loaded, selected ?? null)}
                family={loaded.analysis.cssFamilyName}
                char={selected?.char ?? null}
                codepoints={selected?.codepoints ?? []}
                category={
                  selected
                    ? CATEGORY_LABELS[categoryOf(selected)]
                    : CATEGORY_LABELS.unassigned
                }
              />
              <GlyphOutlineViewer
                glyph={
                  selected ? readRawGlyphFor(loaded, selected.glyphId) : null
                }
                glyphName={selected?.name ?? null}
                advanceWidth={selected?.advanceWidth ?? null}
                available={loaded.structure.loca !== null}
                componentNames={(glyphId) =>
                  loaded.structure.post?.glyphNames?.[glyphId] || null
                }
              />
            </div>
          }
        />
      );
    }
    case "unicode":
      return <UnicodeCoverage coverage={coverage} />;
    case "scripts":
      return <Scripts coverage={coverage} />;
    case "character-map":
      return (
        <CharacterMap
          coverage={coverage}
          family={loaded.analysis.cssFamilyName}
        />
      );
    case "kerning":
      return (
        <KerningViewer
          kerning={loaded.structure.kerning}
          family={loaded.analysis.cssFamilyName}
          codepointToGlyph={loaded.cmap.mapping}
          glyphToCodepoint={glyphToCodepoint(loaded.cmap.mapping)}
          glyphNames={
            loaded.structure.post?.glyphNames
              ? new Map(
                  loaded.structure.post.glyphNames.map((name, index) => [
                    index,
                    name,
                  ]),
                )
              : new Map()
          }
        />
      );
    case "compare":
      return <FontComparison primary={loaded} compared={compared} />;
    case "export":
      return (
        <div className="flex flex-col gap-8">
          <header data-print-hide>
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
              EXPORT
            </h2>
          </header>
          <ExportJsonCard loaded={loaded} glyphs={glyphs} />
          <ExportReportCard loaded={loaded} glyphs={glyphs} />
        </div>
      );
    case "ligatures": {
      const gsub = loaded.structure.layout.find(
        (table) => table.kind === "GSUB",
      );
      const featuresByLookup = new Map<number, string[]>();
      for (const feature of gsub?.features ?? []) {
        for (const index of feature.lookupIndices) {
          const existing = featuresByLookup.get(index) ?? [];
          existing.push(feature.tag);
          featuresByLookup.set(index, existing);
        }
      }
      return (
        <LigaturesView
          ligatures={gsub?.ligatures ?? []}
          hasGsub={gsub !== undefined}
          extendedLookups={
            new Set(
              (gsub?.lookups ?? [])
                .map((lookup, index) => [lookup, index] as const)
                .filter(([lookup]) => lookup.isExtension)
                .map(([, index]) => index),
            )
          }
          featuresByLookup={featuresByLookup}
          glyphNames={
            loaded.structure.post?.glyphNames
              ? new Map(
                  loaded.structure.post.glyphNames.map((name, index) => [
                    index,
                    name,
                  ]),
                )
              : new Map()
          }
          codepoints={glyphToCodepoint(loaded.cmap.mapping)}
          outlines={(glyphId) => outlineFor(loaded, glyphId)}
        />
      );
    }
    default:
      return <Placeholder title={SECTION_TITLES[active]} />;
  }
}

function App() {
  const status = useFontStore((state) => state.status);
  const loaded = useFontStore((state) => state.loaded);
  const [active, setActive] = useState<SectionId>("overview");
  const [selectedGlyphId, setSelectedGlyphId] = useState<number | null>(null);
  const [axisValues, setAxisValues] = useState<AxisValues>({});
  const loadAnotherRef = useRef<HTMLInputElement>(null);
  const compared = useFontStore((state) => state.compared);

  useFontRegistration(status === "ready" ? loaded : null);
  useComparedFontRegistration(compared);

  // A new font means a new set of axes, so any previous positions are dropped.
  const analysedId = loaded?.analysis.id ?? null;
  useEffect(() => {
    setAxisValues({});
  }, [analysedId]);
  // Coverage is derived once from the cmap and reused across sections.
  const coverage = useMemo(
    () => buildCoverage(loaded?.cmap.mapping ?? new Map()),
    [loaded],
  );
  // One glyph list per analysis, shared by the grid and the detail panel.
  const glyphs = useMemo(
    () => (loaded ? buildGlyphList(loaded.structure, loaded.cmap.mapping) : []),
    [loaded],
  );
  const scriptOf = useMemo(() => {
    const cache = new Map<number, string | undefined>();
    return (glyph: GlyphEntry) => {
      if (glyph.codepoint === null) return undefined;
      const cached = cache.get(glyph.codepoint);
      if (cached !== undefined || cache.has(glyph.codepoint)) return cached;
      const script = blockForCodepoint(glyph.codepoint)?.script;
      cache.set(glyph.codepoint, script);
      return script;
    };
  }, []);

  if (status === "idle" || status === "error") {
    return <UploadScreen />;
  }

  if (status === "analyzing" || !loaded) {
    return <AnalyzingScreen />;
  }

  return (
    <>
      <AppShell
        analysis={loaded.analysis}
        isVariable={loaded.structure.variation.isVariable}
        active={active}
        onSelect={setActive}
        onExport={() => setActive("export")}
        onLoadAnother={() => loadAnotherRef.current?.click()}
      >
        {renderSection(
          active,
          loaded,
          coverage,
          glyphs,
          scriptOf,
          selectedGlyphId,
          setSelectedGlyphId,
          axisValues,
          setAxisValues,
          compared,
        )}
      </AppShell>

      <input
        ref={loadAnotherRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setActive("overview");
          void useFontStore.getState().loadFont(file);
        }}
      />
    </>
  );
}

export default App;
