import { useRef, useState } from "react";
import { FontInformation } from "@/components/font/font-information";
import { FontMetricsView } from "@/components/font/font-metrics";
import { OpenTypeTables } from "@/components/font/opentype-tables";
import { Overview } from "@/components/font/overview";
import { Specimen } from "@/components/font/specimen";
import { AppShell } from "@/components/layout/app-shell";
import type { SectionId } from "@/components/layout/app-sidebar";
import { AnalyzingScreen } from "@/components/upload/analyzing-screen";
import { UploadScreen } from "@/components/upload/upload-screen";
import { useFontRegistration } from "@/hooks/use-font-registration";
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

function renderSection(
  active: SectionId,
  loaded: NonNullable<ReturnType<typeof useFontStore.getState>["loaded"]>,
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
    case "specimen":
      return <Specimen family={loaded.analysis.cssFamilyName} />;
    default:
      return <Placeholder title={SECTION_TITLES[active]} />;
  }
}

function App() {
  const status = useFontStore((state) => state.status);
  const loaded = useFontStore((state) => state.loaded);
  const [active, setActive] = useState<SectionId>("overview");
  const loadAnotherRef = useRef<HTMLInputElement>(null);

  useFontRegistration(status === "ready" ? loaded : null);

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
        active={active}
        onSelect={setActive}
        onExport={() => setActive("export")}
        onLoadAnother={() => loadAnotherRef.current?.click()}
      >
        {renderSection(active, loaded)}
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
