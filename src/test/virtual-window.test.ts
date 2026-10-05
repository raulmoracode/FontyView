import { describe, expect, it } from "vitest";
import { computeWindow } from "@/hooks/use-virtual-window";

const BASE = {
  itemHeight: 108,
  overscan: 2,
  viewportHeight: 640,
};

describe("computeWindow", () => {
  it("mounts only a small slice of a very long list", () => {
    const result = computeWindow({
      ...BASE,
      itemCount: 50_000,
      scrollTop: 0,
    });

    // Six rows fit in 640px, plus four rows of overscan.
    expect(result.endIndex - result.startIndex).toBeLessThanOrEqual(10);
    expect(result.endIndex - result.startIndex).toBeGreaterThan(0);

    // The padding still accounts for every item not mounted.
    const mounted = result.endIndex - result.startIndex;
    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe((50_000 - mounted) * 108);
  });

  it("follows the scroll position", () => {
    const at = (scrollTop: number) =>
      computeWindow({ ...BASE, itemCount: 50_000, scrollTop });

    const top = at(0);
    const middle = at(108 * 10_000);
    const bottom = at(108 * 50_000);

    expect(middle.startIndex).toBeGreaterThan(top.startIndex);
    expect(bottom.endIndex).toBe(50_000);
    expect(bottom.paddingBottom).toBe(0);
  });

  it("covers the visible range so scrolling never shows a gap", () => {
    const itemHeight = 108;
    const viewportHeight = 640;
    const overscan = 2;

    for (const scrollTop of [0, 137, 5_400, 108_000, 2_700_000]) {
      const range = computeWindow({
        itemCount: 30_000,
        itemHeight,
        overscan,
        viewportHeight,
        scrollTop,
      });

      const firstVisible = Math.floor(scrollTop / itemHeight);
      const lastVisible = Math.ceil((scrollTop + viewportHeight) / itemHeight);

      expect(range.startIndex).toBeLessThanOrEqual(firstVisible);
      expect(range.endIndex).toBeGreaterThanOrEqual(
        Math.min(30_000, lastVisible),
      );
    }
  });

  it("keeps the scroll height honest at any position", () => {
    // Whatever is mounted, the spacers plus the mounted rows must account
    // for the whole list, or the scrollbar would lie about the length.
    for (const scrollTop of [0, 999, 50_000, 1_234_567]) {
      const range = computeWindow({
        ...BASE,
        itemCount: 50_000,
        scrollTop,
      });
      const totalHeight =
        range.paddingTop +
        range.paddingBottom +
        (range.endIndex - range.startIndex) * 108;
      expect(totalHeight).toBe(50_000 * 108);
    }
  });

  it("handles an empty or degenerate list", () => {
    expect(computeWindow({ ...BASE, itemCount: 0, scrollTop: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
    expect(
      computeWindow({ ...BASE, itemCount: 10, itemHeight: 0, scrollTop: 0 }),
    ).toEqual({
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
  });
});
