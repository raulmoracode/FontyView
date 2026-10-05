declare module "opentype.js" {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export interface PathCommand {
    type: "M" | "L" | "C" | "Q" | "Z";
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export class Path {
    commands: PathCommand[];
    constructor();
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    bezierCurveTo(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x: number,
      y: number,
    ): void;
    quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
    close(): void;
    getBoundingBox(): BoundingBox;
    toPathData(decimals?: number): string;
  }

  export class Glyph {
    constructor(options: {
      name?: string | null;
      unicode?: number;
      advanceWidth?: number;
      path?: Path;
    });
    index: number;
    name: string | null;
    unicode?: number;
    unicodes: number[];
    advanceWidth: number;
    leftSideBearing: number;
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    path: Path;
    getPath(x?: number, y?: number, fontSize?: number): Path;
  }

  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    });
    unitsPerEm: number;
    ascender: number;
    descender: number;
    nGlyphs: number;
    numGlyphs?: number;
    names: Record<string, Record<string, string>>;
    outlinesFormat: "truetype" | "cff" | "cff2";
    glyphs: Glyphs;
    toArrayBuffer(): ArrayBuffer;
    charToGlyphIndex(char: string): number;
    charToGlyph(char: string): Glyph;
    glyphsForString(text: string): Glyph[];
    getEnglishName(name: string): string;
    getKerningValue(left: Glyph, right: Glyph): number;
  }

  export function parse(buffer: ArrayBuffer, options?: unknown): Font;
}
