import { useEffect } from "react";
import type { LoadedFont } from "@/lib/font/analyze";
import { useFontStore } from "@/store/font-store";

/**
 * Registers the analysed font with the document so the browser can render it,
 * and removes it again when the font is replaced or unloaded.
 *
 * The bytes are handed straight to `FontFace`; nothing is uploaded anywhere.
 */
export function useFontRegistration(loaded: LoadedFont | null): void {
  const cssFamilyName = loaded?.analysis.cssFamilyName ?? null;
  const bytes = loaded?.bytes ?? null;

  useEffect(() => {
    if (!cssFamilyName || !bytes) return;
    // Environments without the CSS Font Loading API still get the full
    // analysis, they just render with the interface's own typeface.
    if (typeof FontFace === "undefined" || !document.fonts) {
      useFontStore.getState().setFontReady(false);
      return;
    }

    let cancelled = false;
    const face = new FontFace(
      cssFamilyName,
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );

    face
      .load()
      .then((loadedFace) => {
        if (cancelled) return;
        document.fonts.add(loadedFace);
        useFontStore.getState().setFontReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // The parser already succeeded, so rendering failure is not fatal:
        // the analysis stays usable with the interface's own typeface.
        useFontStore.getState().setFontReady(false);
      });

    return () => {
      cancelled = true;
      document.fonts.forEach((registered) => {
        if (registered.family === cssFamilyName) {
          document.fonts.delete(registered);
        }
      });
    };
  }, [cssFamilyName, bytes]);
}
