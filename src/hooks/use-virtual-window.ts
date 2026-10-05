import { useCallback, useEffect, useRef, useState } from "react";

export type WindowRange = {
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
};

type ComputeOptions = {
  itemCount: number;
  itemHeight: number;
  overscan: number;
  viewportHeight: number;
  scrollTop: number;
};

/**
 * Works out which slice of a long list to mount.
 *
 * Pure, so the arithmetic can be tested directly against lists far larger than
 * anything that would be practical to render in a test.
 */
export function computeWindow({
  itemCount,
  itemHeight,
  overscan,
  viewportHeight,
  scrollTop,
}: ComputeOptions): WindowRange {
  if (itemCount <= 0 || itemHeight <= 0) {
    return { startIndex: 0, endIndex: 0, paddingTop: 0, paddingBottom: 0 };
  }

  const rows = Math.max(0, Math.ceil(viewportHeight / itemHeight));
  const firstVisible = Math.max(0, Math.floor(scrollTop / itemHeight));

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(itemCount, startIndex + rows + overscan * 2);

  return {
    startIndex,
    endIndex,
    paddingTop: startIndex * itemHeight,
    paddingBottom: Math.max(0, (itemCount - endIndex) * itemHeight),
  };
}

type Options = {
  itemCount: number;
  itemHeight: number;
  /** Rows rendered above and below the viewport, to hide scroll seams. */
  overscan?: number;
  /** Fixed viewport height; measured from the container when omitted. */
  viewportHeight?: number;
};

export type VirtualWindow = WindowRange & {
  onScroll: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Windowed rendering for very long lists.
 *
 * A font can contain tens of thousands of glyphs, so only the rows in view
 * plus a small overscan are mounted. Spacer padding above and below keeps the
 * scrollbar honest, so the count the user sees stays the real count rather
 * than a truncated one.
 */
export function useVirtualWindow({
  itemCount,
  itemHeight,
  overscan = 3,
  viewportHeight,
}: Options): VirtualWindow {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (node) setScrollTop(node.scrollTop);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    setMeasuredHeight(node.clientHeight);
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (scrollRef.current) {
        setMeasuredHeight(scrollRef.current.clientHeight);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const range = computeWindow({
    itemCount,
    itemHeight,
    overscan,
    viewportHeight: viewportHeight ?? measuredHeight,
    scrollTop,
  });

  return { ...range, onScroll, scrollRef };
}
