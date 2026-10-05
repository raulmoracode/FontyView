import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LoadedFont } from "@/lib/font/analyze";
import type { GlyphEntry } from "@/lib/font/glyphs";
import { formatCodepoint } from "@/lib/font/unicode-data";
import { formatNumber, orUnavailable } from "@/lib/format";

/** The parts a printed report can be made of. */
const REPORT_SECTIONS = [
  "summary",
  "metadata",
  "tables",
  "metrics",
  "coverage",
  "scripts",
  "features",
  "kerning",
  "ligatures",
  "variable",
  "glyphs",
] as const;

type ReportSection = (typeof REPORT_SECTIONS)[number];

const SECTION_LABELS: Record<ReportSection, string> = {
  summary: "Summary",
  metadata: "Names",
  tables: "Tables",
  metrics: "Metrics",
  coverage: "Coverage",
  scripts: "Scripts",
  features: "OpenType features",
  kerning: "Kerning",
  ligatures: "Ligatures",
  variable: "Variable axes",
  glyphs: "Glyph inventory",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section data-print-section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A label and value pair. The optional third element is the React key, needed
 * when a label can repeat: two lookups can hold the same ligature sequence.
 */
type Fact =
  | [string, string | number | null]
  | [string, string | number | null, string];

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
      {facts.map(([label, value, key]) => (
        <div
          key={key ?? label}
          className="flex justify-between gap-4 border-b border-border-subtle py-1"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-mono tabular-nums">
            {typeof value === "number"
              ? formatNumber(value)
              : value === null || value === ""
                ? "—"
                : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ExportReportCard({
  loaded,
  glyphs,
}: {
  loaded: LoadedFont;
  glyphs: GlyphEntry[];
}) {
  const [sections, setSections] = useState<ReportSection[]>([
    "summary",
    "metadata",
    "tables",
    "metrics",
    "coverage",
    "features",
    "kerning",
    "variable",
  ]);
  const [glyphLimit, setGlyphLimit] = useState(64);
  const wanted = new Set(sections);
  const { analysis, structure, cmap } = loaded;

  const gsub = useMemo(
    () => structure.layout.find((table) => table.kind === "GSUB"),
    [structure.layout],
  );

  const toggle = (section: ReportSection) => {
    setSections((current) =>
      current.includes(section)
        ? current.filter((entry) => entry !== section)
        : [...current, section],
    );
  };

  const printedGlyphs = useMemo(
    () => glyphs.filter((glyph) => glyph.codepoint !== null),
    [glyphs],
  );

  const featureTags = useMemo(() => {
    const tags = new Set<string>();
    for (const table of structure.layout) {
      for (const feature of table.features) tags.add(feature.tag);
    }
    return [...tags].sort();
  }, [structure.layout]);

  return (
    <section
      aria-label="Printable report"
      data-print-root
      className="flex flex-col gap-6"
    >
      <Card data-print-hide>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Report</CardTitle>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print or save as PDF
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            A document laid out for paper. Printing hides the rest of the app
            and starts each section on a new sheet.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {REPORT_SECTIONS.map((section) => (
              <div key={section} className="flex items-center gap-2">
                <Switch
                  id={`report-${section}`}
                  checked={sections.includes(section)}
                  onCheckedChange={() => toggle(section)}
                />
                <Label htmlFor={`report-${section}`} className="font-normal">
                  {SECTION_LABELS[section]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2 border-b pb-4">
          <h2 className="text-xl font-semibold">
            {analysis.metadata.fullName ??
              analysis.metadata.familyName ??
              analysis.file.fileName}
          </h2>
          <p className="text-sm text-muted-foreground">
            FontyView analysis of {analysis.file.fileName} ·{" "}
            {analysis.file.label} · {formatNumber(analysis.file.fileSize)} bytes
            · {new Date(analysis.analyzedAt).toLocaleString()}
          </p>
        </header>

        {wanted.has("summary") ? (
          <Section title={SECTION_LABELS.summary}>
            <Facts
              facts={[
                ["Family", analysis.metadata.familyName ?? null],
                ["Subfamily", analysis.metadata.subfamilyName ?? null],
                ["PostScript name", analysis.metadata.postScriptName ?? null],
                ["Version", analysis.metadata.version ?? null],
                ["Format", analysis.outlineFormat],
                ["Glyphs", analysis.statistics.glyphCount],
                ["Encoded characters", analysis.statistics.unicodePoints],
                ["Tables", structure.directory.tables.length],
              ]}
            />
          </Section>
        ) : null}

        {wanted.has("metadata") ? (
          <Section title={SECTION_LABELS.metadata}>
            <Facts
              facts={structure.names
                .filter((record) => record.value.length > 0)
                .slice(0, 24)
                .map(
                  (record): Fact => [
                    `${record.label} · ${record.platform}`,
                    record.value,
                    `${record.nameId}-${record.platformId}-${record.languageId}`,
                  ],
                )}
            />
          </Section>
        ) : null}

        {wanted.has("tables") ? (
          <Section title={SECTION_LABELS.tables}>
            <Facts
              facts={analysis.tables.map((table) => [
                table.tag,
                formatNumber(table.length),
              ])}
            />
          </Section>
        ) : null}

        {wanted.has("metrics") ? (
          <Section title={SECTION_LABELS.metrics}>
            <Facts
              facts={[
                ["unitsPerEm", structure.head?.unitsPerEm ?? null],
                ["Ascender", structure.hhea?.ascender ?? null],
                ["Descender", structure.hhea?.descender ?? null],
                ["Line gap", structure.hhea?.lineGap ?? null],
                ["Cap height", structure.os2?.sCapHeight ?? null],
                ["x-height", structure.os2?.sxHeight ?? null],
                ["Weight class", structure.os2?.usWeightClass ?? null],
                ["Width class", structure.os2?.usWidthClass ?? null],
                ["Italic angle", structure.post?.italicAngle ?? null],
                ["Average advance", analysis.statistics.averageAdvance ?? null],
              ]}
            />
          </Section>
        ) : null}

        {wanted.has("coverage") ? (
          <Section title={SECTION_LABELS.coverage}>
            <Facts
              facts={[
                ["Encoded characters", cmap.mapping.size],
                ["cmap format", cmap.format],
                ["Platform", cmap.platformId],
                ["Encoding", cmap.encodingId],
              ]}
            />
          </Section>
        ) : null}

        {wanted.has("scripts") ? (
          <Section title={SECTION_LABELS.scripts}>
            {analysis.scripts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No script could be identified from the encoded characters.
              </p>
            ) : (
              <Facts
                facts={analysis.scripts.map((script) => [
                  script.label,
                  script.characterCount,
                ])}
              />
            )}
          </Section>
        ) : null}

        {wanted.has("features") ? (
          <Section title={SECTION_LABELS.features}>
            {featureTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The font has no GSUB or GPOS table, so it applies no features.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {featureTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {wanted.has("kerning") ? (
          <Section title={SECTION_LABELS.kerning}>
            {structure.kerning.pairs.size === 0 ? (
              <p className="text-sm text-muted-foreground">
                No kerning pairs are defined.
              </p>
            ) : (
              <Facts
                facts={[
                  ["Distinct pairs", structure.kerning.pairs.size],
                  ...structure.kerning.sources.map(
                    (source): Fact => [
                      `${source} pairs`,
                      structure.kerning.counts[source],
                    ],
                  ),
                ]}
              />
            )}
          </Section>
        ) : null}

        {wanted.has("ligatures") ? (
          <Section title={SECTION_LABELS.ligatures}>
            {!gsub ? (
              <p className="text-sm text-muted-foreground">
                The font has no GSUB table.
              </p>
            ) : gsub.ligatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The font defines no ligature substitutions.
              </p>
            ) : (
              <Facts
                facts={gsub.ligatures.map(
                  (ligature): Fact => [
                    ligature.components
                      .map(
                        (glyphId) =>
                          printedGlyphs.find(
                            (glyph) => glyph.glyphId === glyphId,
                          )?.char ?? `gid ${glyphId}`,
                      )
                      .join(" + "),
                    ligature.glyphId,
                    // Two lookups can hold the same sequence, so the lookup has
                    // to be part of the key.
                    `${ligature.lookupIndex}-${ligature.glyphId}-${ligature.components.join("-")}`,
                  ],
                )}
              />
            )}
          </Section>
        ) : null}

        {wanted.has("variable") ? (
          <Section title={SECTION_LABELS.variable}>
            {!structure.variation.isVariable ? (
              <p className="text-sm text-muted-foreground">
                The font has no variation axes.
              </p>
            ) : (
              <Facts
                facts={[
                  ...structure.variation.axes.map(
                    (axis): Fact => [
                      `${axis.tag} · ${axis.name}`,
                      `${axis.minimum} – ${axis.default} – ${axis.maximum}`,
                    ],
                  ),
                  ["Named instances", structure.variation.instances.length],
                ]}
              />
            )}
          </Section>
        ) : null}

        {wanted.has("glyphs") ? (
          <Section title={SECTION_LABELS.glyphs}>
            <p
              className="break-all text-2xl leading-relaxed"
              style={{ fontFamily: `"${analysis.cssFamilyName}", monospace` }}
            >
              {printedGlyphs
                .slice(0, glyphLimit)
                .map((glyph) => glyph.char)
                .join("")}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(Math.min(glyphLimit, printedGlyphs.length))} of{" "}
              {formatNumber(printedGlyphs.length)} encoded characters
            </p>
            {printedGlyphs.length > glyphLimit ? (
              <div data-print-hide className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGlyphLimit((current) => current + 64)}
                >
                  Show 64 more
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGlyphLimit(printedGlyphs.length)}
                >
                  Show all
                </Button>
              </div>
            ) : null}
            <div className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-3">
              {printedGlyphs.slice(0, glyphLimit).map((glyph) => (
                <div key={glyph.glyphId} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {glyph.codepoint === null
                      ? orUnavailable("unmapped")
                      : formatCodepoint(glyph.codepoint)}
                  </span>
                  <span className="truncate font-mono">
                    {glyph.name ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </section>
  );
}
