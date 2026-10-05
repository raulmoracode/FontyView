import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LoadedFont } from "@/lib/font/analyze";
import {
  buildExport,
  EXPORT_SECTIONS,
  type ExportSection,
  exportFileName,
  SECTION_LABELS,
  serializeExport,
} from "@/lib/font/export";
import type { GlyphEntry } from "@/lib/font/glyphs";
import { formatNumber } from "@/lib/format";

/** Rough size of the preview, so the choice of sections stays legible. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ExportJsonCard({
  loaded,
  glyphs,
}: {
  loaded: LoadedFont;
  glyphs: GlyphEntry[];
}) {
  const [sections, setSections] = useState<ExportSection[]>([
    "metadata",
    "tables",
    "metrics",
    "unicode",
    "features",
    "kerning",
    "variable",
  ]);
  const [pretty, setPretty] = useState(true);

  // The timestamp is stamped when the sections change, so the preview does
  // not churn on every render.
  const report = useMemo(
    () => buildExport(loaded, sections, glyphs),
    [loaded, sections, glyphs],
  );

  const text = useMemo(() => serializeExport(report, pretty), [report, pretty]);
  const size = new Blob([text]).size;
  const fileName = exportFileName(loaded);

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (section: ExportSection) => {
    setSections((current) =>
      current.includes(section)
        ? current.filter((entry) => entry !== section)
        : [...current, section],
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>JSON</CardTitle>
        <Button onClick={download} disabled={sections.length === 0}>
          <Download aria-hidden="true" />
          Download
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          The analysis as JSON, for scripts and pipelines. The font's own bytes
          are left out: everything exported here was read out of them.
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {EXPORT_SECTIONS.map((section) => (
            <div key={section} className="flex items-center gap-2">
              <Switch
                id={`export-${section}`}
                checked={sections.includes(section)}
                onCheckedChange={() => toggle(section)}
              />
              <Label htmlFor={`export-${section}`} className="font-normal">
                {SECTION_LABELS[section]}
              </Label>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="export-pretty"
            checked={pretty}
            onCheckedChange={(value) => setPretty(value)}
          />
          <Label htmlFor="export-pretty" className="font-normal">
            Pretty print
          </Label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{fileName}</Badge>
          <Badge variant="outline">{formatBytes(size)}</Badge>
          <Badge variant="outline">
            {formatNumber(sections.length)} of{" "}
            {formatNumber(EXPORT_SECTIONS.length)} sections
          </Badge>
        </div>

        <pre className="max-h-96 overflow-auto rounded-md bg-muted/40 p-4 font-mono text-xs">
          {text.slice(0, 4000)}
          {text.length > 4000 ? "\n…" : ""}
        </pre>
      </CardContent>
    </Card>
  );
}
