/**
 * User-facing failure reasons for font analysis. Each reason maps to a stable
 * message so internal parser errors never leak into the interface.
 */
export type FontErrorReason =
  | "empty-file"
  | "unsupported-format"
  | "not-a-font"
  | "corrupted"
  | "collection-empty"
  | "woff2-unavailable"
  | "unexpected";

export class FontAnalysisError extends Error {
  readonly reason: FontErrorReason;
  readonly detail?: string;

  constructor(reason: FontErrorReason, detail?: string) {
    super(`Font analysis failed (${reason})${detail ? `: ${detail}` : ""}`);
    this.name = "FontAnalysisError";
    this.reason = reason;
    this.detail = detail;
  }
}

const MESSAGES: Record<FontErrorReason, { title: string; body: string }> = {
  "empty-file": {
    title: "This file is empty",
    body: "The file you selected contains no data. Choose a font file and try again.",
  },
  "unsupported-format": {
    title: "Unsupported format",
    body: "Font Analyzer reads TTF, OTF, WOFF and WOFF2 files. This file uses a container it cannot open.",
  },
  "not-a-font": {
    title: "We couldn't analyze this font",
    body: "The file may be corrupted or use a structure that isn't currently supported.",
  },
  corrupted: {
    title: "This font looks damaged",
    body: "The file is a font, but part of its structure could not be read. It may be truncated or corrupted.",
  },
  "collection-empty": {
    title: "No font found in this collection",
    body: "The file is a font collection, but it does not contain any readable font.",
  },
  "woff2-unavailable": {
    title: "WOFF2 analysis unavailable",
    body: "WOFF2 needs a Brotli decompressor that could not be loaded in this browser, so the internals of this font cannot be read.",
  },
  unexpected: {
    title: "We couldn't analyze this font",
    body: "Something went wrong while reading this font. The file may be corrupted or use a structure that isn't currently supported.",
  },
};

export function fontErrorMessage(error: unknown): {
  title: string;
  body: string;
} {
  const reason =
    error instanceof FontAnalysisError ? error.reason : ("unexpected" as const);
  return MESSAGES[reason];
}
