/**
 * Human-readable descriptions for OpenType table tags.
 *
 * Only consulted for tables the font actually contains; nothing here is
 * presented as font data.
 */
const DESCRIPTIONS: Record<string, string> = {
  BASE: "Baseline and horizontal script attachment",
  "BDF ": "Glyph data (bdf)",
  CBDT: "Colour bitmap data",
  CBLC: "Colour bitmap location",
  "CFF ": "Compact Font Format",
  CFF2: "Compact Font Format 2",
  COLR: "Layered colour glyphs",
  CPAL: "Colour palette",
  DSIG: "Digital signature",
  EBDT: "Embedded bitmap data",
  EBLC: "Embedded bitmap location",
  EBSC: "Embedded bitmap scaling",
  fvar: "Font variations",
  Feat: "Feature definitions",
  GDEF: "Glyph definition data",
  Gloc: "Glyph location",
  Glat: "Glyph attributes",
  glyf: "Glyph outlines",
  GPOS: "Glyph positioning",
  GSUB: "Glyph substitution",
  gasp: "Grid-fitting and smoothing",
  hdmx: "Horizontal device metrics",
  head: "Font header",
  hhea: "Horizontal header",
  hmtx: "Horizontal metrics",
  kern: "Kerning",
  loca: "Glyph locations",
  LTSH: "Line gap thresholds",
  maxp: "Maximum profile",
  meta: "Font metadata",
  mort: "Morphing table",
  morx: "Morphing table",
  name: "Naming table",
  opbd: "Optical bounds",
  "OS/2": "OS/2 and Windows metrics",
  PCLT: "PC character mapping",
  post: "PostScript glyph names",
  prep: "Control value program",
  Prop: "Glyph properties",
  sbix: "Apple bitmap glyphs",
  trak: "Font tracking",
  VDMX: "Vertical device metrics",
  vhea: "Vertical header",
  vmtx: "Vertical metrics",
  vorg: "Vertical origin",
  Zapf: "Zapf glyph names",
};

export function describeTable(tag: string): string {
  const known = DESCRIPTIONS[tag];
  if (known) return known;
  if (tag.length === 4) {
    if (tag.startsWith("var")) return "Font variations";
    if (tag.startsWith("MVAR")) return "Metric variations";
  }
  return "Font-specific table";
}
