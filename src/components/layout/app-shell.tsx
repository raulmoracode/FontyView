import { Download, PanelLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FontAnalysis } from "@/lib/font/types";
import { formatNumber } from "@/lib/format";
import { useFontStore } from "@/store/font-store";
import { AppSidebar, type SectionId } from "./app-sidebar";

function summaryStat(label: string, value: string) {
  return (
    <div key={label} className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function FontHeader({
  analysis,
  onExport,
  onLoadAnother,
}: {
  analysis: FontAnalysis;
  onExport: () => void;
  onLoadAnother: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 border-b px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1
            className="truncate text-lg font-semibold tracking-tight"
            style={{ fontFamily: `"${analysis.cssFamilyName}"` }}
          >
            {analysis.metadata.fullName ??
              analysis.metadata.familyName ??
              analysis.file.fileName}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {analysis.metadata.typographicSubfamily ??
              analysis.metadata.subfamilyName ??
              "Style not available"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download aria-hidden="true" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onLoadAnother}>
            <Plus aria-hidden="true" />
            Load another font
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {summaryStat("Glyphs", formatNumber(analysis.statistics.glyphCount))}
        {summaryStat("Format", analysis.file.label)}
        {summaryStat(
          "Unicode",
          formatNumber(analysis.statistics.unicodePoints),
        )}
        <Separator orientation="vertical" className="hidden h-8 sm:block" />
        <div
          className="min-w-0 truncate text-xs text-muted-foreground"
          style={{ fontFamily: `"${analysis.cssFamilyName}"` }}
        >
          {analysis.metadata.sampleText ??
            "The quick brown fox jumps over the lazy dog"}
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  analysis,
  active,
  onSelect,
  onExport,
  onLoadAnother,
  children,
}: {
  analysis: FontAnalysis;
  active: SectionId;
  onSelect: (id: SectionId) => void;
  onExport: () => void;
  onLoadAnother: () => void;
  children: React.ReactNode;
}) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const clearFont = useFontStore((state) => state.clearFont);
  const availability = { isVariable: false };

  const sidebar = (
    <AppSidebar
      active={active}
      onSelect={(id) => {
        onSelect(id);
        setIsNavOpen(false);
      }}
      availability={availability}
      className="p-4"
    />
  );

  return (
    <div className="flex min-h-svh w-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={isNavOpen}
          aria-controls="app-navigation"
          onClick={() => setIsNavOpen((open) => !open)}
        >
          <PanelLeft aria-hidden="true" />
          <span className="sr-only">Toggle navigation</span>
        </Button>
        <span className="truncate text-sm font-medium">
          {analysis.metadata.familyName ?? analysis.file.fileName}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          id="app-navigation"
          className={
            isNavOpen
              ? "border-b bg-sidebar lg:block lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
              : "hidden lg:block lg:w-60 lg:shrink-0 lg:border-r"
          }
        >
          <div className="sticky top-0 max-h-svh overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <span className="text-sm font-semibold tracking-tight">
                Font Analyzer
              </span>
            </div>
            {sidebar}
            <div className="px-4 py-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  clearFont();
                  onLoadAnother();
                }}
              >
                <Plus aria-hidden="true" />
                Load another font
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <FontHeader
            analysis={analysis}
            onExport={onExport}
            onLoadAnother={onLoadAnother}
          />
          <div className="min-w-0 flex-1 px-6 py-6">
            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
