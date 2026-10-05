import type {
  GlyphComponent,
  GlyphContour,
  GlyphPoint,
  RawGlyph,
} from "./tables/glyf";

/**
 * Converts TrueType contours into SVG path data.
 *
 * TrueType stores quadratic B-splines with implied on-curve midpoints between
 * consecutive off-curve points, so the conversion is not a straight join: two
 * consecutive off-curve points imply an on-curve point at their midpoint, and a
 * contour that starts off-curve is rotated to begin on-curve.
 */
export function contoursToPath(
  contours: { points: GlyphPoint[] }[],
  precision = 2,
): string {
  const factor = 10 ** precision;
  const round = (value: number) => String(Math.round(value * factor) / factor);
  return contours
    .map((contour) => contourToPath(contour.points, round))
    .filter((segment) => segment.length > 0)
    .join(" ");
}

function contourToPath(
  points: GlyphPoint[],
  round: (n: number) => string,
): string {
  if (points.length === 0) return "";

  const startIndex = points.findIndex((point) => point.onCurve);

  // A contour with no on-curve point at all is closed by an implied point
  // halfway between its last and first points.
  if (startIndex === -1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return "";
    const implied = {
      x: (first.x + last.x) / 2,
      y: (first.y + last.y) / 2,
      onCurve: true,
      lastPointOfContour: false,
    };
    return walk([implied, ...points], round);
  }

  // Rotate the contour so it begins on-curve, preserving order.
  const rotated = [...points.slice(startIndex), ...points.slice(0, startIndex)];
  return walk(rotated, round);
}

function walk(points: GlyphPoint[], round: (n: number) => string): string {
  const start = points[0];
  if (!start) return "";

  const commands: string[] = [`M ${round(start.x)} ${round(start.y)}`];
  const count = points.length;

  // Two consecutive off-curve points imply an on-curve point at their
  // midpoint, so a control point is held back until the point that closes
  // its quadratic is known.
  let control: GlyphPoint | null = null;

  for (let i = 1; i < count; i++) {
    const point = points[i];
    if (!point) continue;

    if (point.onCurve) {
      if (control) {
        commands.push(
          `Q ${round(control.x)} ${round(control.y)} ${round(point.x)} ${round(point.y)}`,
        );
        control = null;
      } else {
        commands.push(`L ${round(point.x)} ${round(point.y)}`);
      }
      continue;
    }

    if (control) {
      const impliedX = (control.x + point.x) / 2;
      const impliedY = (control.y + point.y) / 2;
      commands.push(
        `Q ${round(control.x)} ${round(control.y)} ${round(impliedX)} ${round(impliedY)}`,
      );
    }
    control = point;
  }

  // A contour ending on an off-curve point closes back to the start.
  if (control) {
    commands.push(
      `Q ${round(control.x)} ${round(control.y)} ${round(start.x)} ${round(start.y)}`,
    );
  }

  commands.push("Z");
  return commands.join(" ");
}

/** Deep enough for any real composite, shallow enough to stop a cycle. */
const MAX_COMPOSITE_DEPTH = 8;

/**
 * A composite glyph's contours in its own space, resolved from the glyphs it
 * references. Ligature glyphs are usually composites, so this is what makes a
 * ligature drawable.
 */
export function glyphContours(
  glyph: RawGlyph | null,
  resolve: (glyphId: number) => RawGlyph | null,
  depth = 0,
): GlyphContour[] {
  if (!glyph || depth > MAX_COMPOSITE_DEPTH) return [];
  if (!glyph.isComposite) return glyph.contours;

  const out: GlyphContour[] = [];
  for (const component of glyph.components) {
    for (const contour of glyphContours(
      resolve(component.glyphId),
      resolve,
      depth + 1,
    )) {
      out.push(transformContour(contour, component));
    }
  }
  return out;
}

/** Path data for a glyph, following composite references. */
export function glyphToPath(
  glyph: RawGlyph | null,
  resolve: (glyphId: number) => RawGlyph | null,
): string {
  return contoursToPath(glyphContours(glyph, resolve));
}

/**
 * Places a component where the composite asks for it. Per the spec a component
 * is either offset by x and y, or placed by a 2x2 matrix, and the offset is
 * only meaningful when the matrix is the identity.
 */
function transformContour(
  contour: GlyphContour,
  component: GlyphComponent,
): GlyphContour {
  const [a, b, c, d] = component.transform;
  const identity = a === 1 && b === 0 && c === 0 && d === 1;
  const offsetX = identity ? component.x : 0;
  const offsetY = identity ? component.y : 0;
  const place = (point: GlyphPoint): GlyphPoint => ({
    ...point,
    x: a * point.x + c * point.y + offsetX,
    y: b * point.x + d * point.y + offsetY,
  });

  return {
    ...contour,
    points: contour.points.map(place),
  };
}
