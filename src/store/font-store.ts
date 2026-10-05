import { create } from "zustand";
import { analyzeFontFile, type LoadedFont } from "@/lib/font/analyze";
import { fontErrorMessage } from "@/lib/font/errors";

export type FontStatus = "idle" | "analyzing" | "ready" | "error";

export type FontState = {
  status: FontStatus;
  loaded: LoadedFont | null;
  progressStep: string | null;
  error: { title: string; body: string } | null;
  /** False when the browser refused the font for rendering. */
  renderReady: boolean;
  fileName: string | null;

  loadFont: (file: File) => Promise<void>;
  clearFont: () => void;
  setFontReady: (ready: boolean) => void;
};

export const useFontStore = create<FontState>((set) => ({
  status: "idle",
  loaded: null,
  progressStep: null,
  error: null,
  renderReady: false,
  fileName: null,

  async loadFont(file) {
    set({
      status: "analyzing",
      error: null,
      progressStep: "Reading font",
      // Drop the previous font immediately so a new file never mixes with it.
      loaded: null,
      renderReady: false,
      fileName: file.name,
    });

    try {
      const loaded = await analyzeFontFile(file, (progress) => {
        set({ progressStep: progress.step });
      });
      set({
        status: "ready",
        loaded,
        progressStep: null,
        error: null,
      });
    } catch (error) {
      set({
        status: "error",
        loaded: null,
        progressStep: null,
        fileName: null,
        error: fontErrorMessage(error),
      });
    }
  },

  clearFont() {
    set({
      status: "idle",
      loaded: null,
      progressStep: null,
      error: null,
      renderReady: false,
      fileName: null,
    });
  },

  setFontReady(ready) {
    set({ renderReady: ready });
  },
}));
