import { type CmapAnalysis, parseCmap } from "./cmap";
import {
  type ContainerInfo,
  readContainerInfo,
  readOutlineFormat,
} from "./container";
import { FontAnalysisError } from "./errors";
import {
  createUnpackedFont,
  type FontStructure,
  readFontStructure,
  unpackFont,
} from "./font-source";
import { describeTable } from "./table-descriptions";
import { NAME_IDS, pickNames } from "./tables/core";
import type {
  FontAnalysis,
  FontMetadata,
  FontStatistics,
  ScriptSupport,
} from "./types";
import { blockForCodepoint, KNOWN_SCRIPTS } from "./unicode-data";

export type AnalysisProgress = {
  step: string;
};

export type LoadedFont = {
  analysis: FontAnalysis;
  structure: FontStructure;
  cmap: CmapAnalysis;
  /** The bytes exactly as the browser supplied them, for FontFace registration. */
  bytes: Uint8Array;
  container: ContainerInfo;
};

let analysisCounter = 0;

function cssFamilyName(): string {
  analysisCounter += 1;
  return `fontyview-analyzed-${analysisCounter}`;
}

function buildMetadata(structure: FontStructure): FontMetadata {
  const names = pickNames(structure.names);
  const byNameId = (id: number) => {
    const value = names.get(id);
    return value && value.length > 0 ? value : null;
  };

  const allNames: Record<number, string[]> = {};
  for (const record of structure.names) {
    if (!record.value) continue;
    const list = allNames[record.nameId] ?? [];
    if (!list.includes(record.value)) list.push(record.value);
    allNames[record.nameId] = list;
  }

  return {
    familyName: byNameId(NAME_IDS.family),
    subfamilyName: byNameId(NAME_IDS.subfamily),
    fullName: byNameId(NAME_IDS.fullName),
    postScriptName: byNameId(NAME_IDS.postScriptName),
    typographicFamily: byNameId(NAME_IDS.typographicFamily),
    typographicSubfamily: byNameId(NAME_IDS.typographicSubfamily),
    version: byNameId(NAME_IDS.version),
    manufacturer: byNameId(NAME_IDS.manufacturer),
    designer: byNameId(NAME_IDS.designer),
    designerUrl: byNameId(NAME_IDS.designerUrl),
    manufacturerUrl: byNameId(NAME_IDS.vendorUrl),
    copyright: byNameId(NAME_IDS.copyright),
    trademark: byNameId(NAME_IDS.trademark),
    license: byNameId(NAME_IDS.license),
    licenseUrl: byNameId(NAME_IDS.licenseUrl),
    description: byNameId(NAME_IDS.description),
    sampleText: byNameId(NAME_IDS.sampleText),
    nameRecords: structure.names,
    allNames,
  };
}

function buildStatistics(
  structure: FontStructure,
  cmap: CmapAnalysis,
): FontStatistics {
  const advances = structure.metrics.map((metric) => metric.advanceWidth);
  const hasAdvances = advances.length > 0;

  return {
    glyphCount: structure.numGlyphs,
    unicodePoints: cmap.mapping.size,
    simpleGlyphs: null,
    compositeGlyphs: null,
    averageAdvance: hasAdvances
      ? Math.round(
          advances.reduce((total, value) => total + value, 0) / advances.length,
        )
      : null,
    minimumAdvance: hasAdvances ? Math.min(...advances) : null,
    maximumAdvance: hasAdvances ? Math.max(...advances) : null,
  };
}

function buildScripts(cmap: CmapAnalysis): ScriptSupport[] {
  const counts = new Map<string, number>();
  for (const codepoint of cmap.mapping.keys()) {
    const block = blockForCodepoint(codepoint);
    if (!block?.script) continue;
    counts.set(block.script, (counts.get(block.script) ?? 0) + 1);
  }

  return KNOWN_SCRIPTS.map((script) => ({
    script,
    label: script,
    characterCount: counts.get(script) ?? 0,
  })).filter((entry) => entry.characterCount > 0);
}

/**
 * Reads a font file and produces everything the interface needs.
 *
 * The result is intentionally self-contained: once a file has been through
 * this function, no section of the app ever re-parses the binary.
 */
export async function analyzeFontFile(
  file: File,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<LoadedFont> {
  onProgress?.({ step: "Reading font" });
  const bytes = new Uint8Array(await file.arrayBuffer());

  onProgress?.({ step: "Detecting format" });
  const container = readContainerInfo(bytes);

  onProgress?.({ step: "Unpacking tables" });
  const sfnt = await unpackFont(bytes);

  onProgress?.({ step: "Reading font header" });
  const font = createUnpackedFont(sfnt);
  const structure = readFontStructure(font);

  if (structure.numGlyphs === 0) {
    throw new FontAnalysisError("corrupted", "font declares no glyphs");
  }

  onProgress?.({ step: "Reading character map" });
  const cmapEntry = structure.directory.tables.find(
    (table) => table.tag === "cmap",
  );
  if (!cmapEntry) {
    throw new FontAnalysisError("not-a-font", "font has no cmap table");
  }
  const cmap = parseCmap(
    font.bytes.subarray(cmapEntry.offset, cmapEntry.offset + cmapEntry.length),
  );

  if (cmap.mapping.size === 0) {
    throw new FontAnalysisError(
      "not-a-font",
      "font has no usable character map",
    );
  }

  onProgress?.({ step: "Analysing metrics" });
  const metadata = buildMetadata(structure);
  const statistics = buildStatistics(structure, cmap);
  const scripts = buildScripts(cmap);
  const outlineFormat = readOutlineFormat(structure.directory.tables);

  onProgress?.({ step: "Building analysis" });

  return {
    analysis: {
      id: `${Date.now().toString(36)}-${analysisCounter}`,
      file: {
        format: container.format,
        label: container.label,
        fileSize: file.size,
        fileName: file.name,
        fontCount: container.fontCount,
      },
      outlineFormat,
      metadata,
      statistics,
      scripts,
      unitsPerEm: structure.head?.unitsPerEm ?? null,
      tables: structure.tableSizes.map((table) => ({
        ...table,
        description: describeTable(table.tag),
      })),
      cssFamilyName: cssFamilyName(),
      analyzedAt: Date.now(),
    },
    structure,
    cmap,
    bytes,
    container,
  };
}
