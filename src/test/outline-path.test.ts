import { describe, expect, it } from "vitest";
import { contoursToPath } from "@/lib/font/outline-path";
import type { GlyphPoint } from "@/lib/font/tables/glyf";

function point(
  x: number,
  y: number,
  onCurve: boolean,
  lastPointOfContour = false,
): GlyphPoint {
  return { x, y, onCurve, lastPointOfContour };
}

describe("contoursToPath", () => {
  it("emits a polygon for an all-on-curve contour", () => {
    const path = contoursToPath([
      {
        points: [point(0, 0, true), point(100, 0, true), point(100, 100, true)],
      },
    ]);
    expect(path).toBe("M 0 0 L 100 0 L 100 100 Z");
  });

  it("inserts the implied midpoint between two off-curve points", () => {
    const path = contoursToPath([
      {
        points: [
          point(0, 0, true),
          point(50, 100, false),
          point(100, 0, false),
        ],
      },
    ]);
    // The two control points imply an on-curve point at (75, 50), and the
    // contour still has to close back to the start, so it takes two curves.
    expect(path).toBe("M 0 0 Q 50 100 75 50 Q 100 0 0 0 Z");
  });

  it("rotates a contour that starts off-curve", () => {
    const path = contoursToPath([
      {
        points: [point(50, 100, false), point(100, 0, true), point(0, 0, true)],
      },
    ]);
    // Rotated to begin at (100, 0).
    expect(path).toBe("M 100 0 L 0 0 Q 50 100 100 0 Z");
  });

  it("synthesises a start point when no point is on-curve", () => {
    const path = contoursToPath([
      {
        points: [
          point(0, 0, false),
          point(100, 0, false),
          point(100, 100, false),
          point(0, 100, false),
        ],
      },
    ]);
    // Implied start at the midpoint of the last and first points: (0, 50).
    expect(path).toBe(
      "M 0 50 Q 0 0 50 0 Q 100 0 100 50 Q 100 100 50 100 Q 0 100 0 50 Z",
    );
  });

  it("handles empty and single-point contours", () => {
    expect(contoursToPath([])).toBe("");
    expect(contoursToPath([{ points: [] }])).toBe("");
  });

  it("joins several contours into one path", () => {
    const path = contoursToPath([
      { points: [point(0, 0, true), point(10, 0, true)] },
      { points: [point(20, 0, true), point(30, 0, true)] },
    ]);
    expect(path).toBe("M 0 0 L 10 0 Z M 20 0 L 30 0 Z");
  });

  it("rounds to the requested precision", () => {
    const path = contoursToPath(
      [{ points: [point(0, 0, true), point(10.123456, 20.987654, true)] }],
      2,
    );
    expect(path).toBe("M 0 0 L 10.12 20.99 Z");
  });
});
