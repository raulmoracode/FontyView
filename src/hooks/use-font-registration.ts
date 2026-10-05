import { useEffect } from "react";
import type { LoadedFont } from "@/lib/font/analyze";
import { useFontStore } from "@/store/font-store";

/** Which slot of the store a registration belongs to. */
type Slot = "font" | "compared";

function markReady(slot: Slot, ready: boolean) {
  const store = useFontStore.getState();
  if (slot === "font") store.setFontReady(ready);
  else store.setComparedFontReady(ready);
}

function markReset(slot: Slot) {
  const store = useFontStore.getState();
  if (slot === "font") store.setFontReady(false);
  else store.setComparedFontReady(false);
}

/**
 * Registers a loaded font with the browser so it can be rendered, under the
 * family name the analysis already carries.
 *
 * Environments without the CSS Font Loading API still get the full analysis,
 * they just render with the interface's own typeface.
 */
function useRegisterSlot(slot: Slot, loaded: LoadedFont | null): void {
  const cssFamilyName = loaded?.analysis.cssFamilyName ?? null;
  const bytes = loaded?.bytes ?? null;

  useEffect(() => {
    if (!cssFamilyName || !bytes) {
      markReset(slot);
      return;
    }
    if (typeof FontFace === "undefined" || !document.fonts) {
      markReady(slot, false);
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
        markReady(slot, true);
      })
      .catch(() => {
        if (cancelled) return;
        // The parser already succeeded, so rendering failure is not fatal:
        // the analysis stays usable with the interface's own typeface.
        markReady(slot, false);
      });

    return () => {
      cancelled = true;
      document.fonts.forEach((registered) => {
        if (registered.family === cssFamilyName) {
          document.fonts.delete(registered);
        }
      });
    };
  }, [slot, cssFamilyName, bytes]);
}

/** Registers the font under analysis. */
export function useFontRegistration(loaded: LoadedFont | null): void {
  useRegisterSlot("font", loaded);
}

/** Registers the second font, when one is being compared. */
export function useComparedFontRegistration(loaded: LoadedFont | null): void {
  useRegisterSlot("compared", loaded);
}
