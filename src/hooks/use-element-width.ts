import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks an element's content box so a virtualised grid can size itself to the
 * space it actually has, rather than to a guess about the viewport.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const next = node.clientWidth;
    // Only react to meaningful changes so scrolling does not thrash state.
    if (Math.abs(next - width) > 1) setWidth(next);
  }, [width]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, width };
}
