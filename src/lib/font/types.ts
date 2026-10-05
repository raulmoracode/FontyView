import type { ContainerFormat, OutlineFormat } from "./container";
import type { NameRecord } from "./tables/core";

/**
 * Optional font values are `null` when the font genuinely does not carry them,
 * which the interface renders as "Not available". Nothing here is ever guessed.
 */
export type Maybe<T> = T | null;

export type FontContainerSummary = {
  format: ContainerFormat;
  label: string;
  /** Original file size in bytes. */
  fileSize: number;
  fileName: string;
  fontCount?: number;
};

export type FontMetadata = {
  familyName: Maybe<string>;
  subfamilyName: Maybe<string>;
  fullName: Maybe<string>;
  postScriptName: Maybe<string>;
  typographicFamily: Maybe<string>;
  typographicSubfamily: Maybe<string>;
  version: Maybe<string>;
  manufacturer: Maybe<string>;
  designer: Maybe<string>;
  designerUrl: Maybe<string>;
  manufacturerUrl: Maybe<string>;
  copyright: Maybe<string>;
  trademark: Maybe<string>;
  license: Maybe<string>;
  licenseUrl: Maybe<string>;
  description: Maybe<string>;
  sampleText: Maybe<string>;
  /** Every decoded `name` record, keyed by name ID. */
  nameRecords: NameRecord[];
  /** Raw name IDs, including Windows-only ones, for the inspector. */
  allNames: Record<number, string[]>;
};

export type FontStatistics = {
  glyphCount: number;
  unicodePoints: number;
  simpleGlyphs: Maybe<number>;
  compositeGlyphs: Maybe<number>;
  averageAdvance: Maybe<number>;
  minimumAdvance: Maybe<number>;
  maximumAdvance: Maybe<number>;
};

export type ScriptSupport = {
  script: string;
  label: string;
  characterCount: number;
};

export type FontAnalysis = {
  id: string;
  file: FontContainerSummary;
  outlineFormat: OutlineFormat;
  metadata: FontMetadata;
  statistics: FontStatistics;
  scripts: ScriptSupport[];
  /** `head.unitsPerEm`, the design grid the font is drawn on. */
  unitsPerEm: Maybe<number>;
  /** Every table the font actually contains, with its real size. */
  tables: { tag: string; length: number; description: string }[];
  /** CSS family name used to render the uploaded font. */
  cssFamilyName: string;
  analyzedAt: number;
};
