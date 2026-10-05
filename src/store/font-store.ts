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

  /** A second font held for comparison, analysed independently of the first. */
  compared: LoadedFont | null;
  comparedStatus: "idle" | "analyzing" | "ready" | "error";
  comparedError: { title: string; body: string } | null;
  comparedFileName: string | null;
  /** False when the browser refused the second font for rendering. */
  comparedRenderReady: boolean;

  loadFont: (file: File) => Promise<void>;
  clearFont: () => void;
  setFontReady: (ready: boolean) => void;
  loadComparedFont: (file: File) => Promise<void>;
  clearComparedFont: () => void;
  setComparedFontReady: (ready: boolean) => void;
};

export const useFontStore = create<FontState>((set) => ({
  status: "idle",
  loaded: null,
  progressStep: null,
  error: null,
  renderReady: false,
  fileName: null,
  compared: null,
  comparedStatus: "idle",
  comparedError: null,
  comparedFileName: null,
  comparedRenderReady: false,

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
      // The comparison font belongs to the previous font's session.
      compared: null,
      comparedStatus: "idle",
      comparedError: null,
      comparedFileName: null,
      comparedRenderReady: false,
    });
  },

  setFontReady(ready) {
    set({ renderReady: ready });
  },

  async loadComparedFont(file) {
    set({
      comparedStatus: "analyzing",
      comparedError: null,
      comparedFileName: file.name,
      compared: null,
      comparedRenderReady: false,
    });

    try {
      const compared = await analyzeFontFile(file);
      set({ comparedStatus: "ready", compared, comparedError: null });
    } catch (error) {
      set({
        comparedStatus: "error",
        compared: null,
        comparedFileName: null,
        comparedError: fontErrorMessage(error),
      });
    }
  },

  clearComparedFont() {
    set({
      compared: null,
      comparedStatus: "idle",
      comparedError: null,
      comparedFileName: null,
      comparedRenderReady: false,
    });
  },

  setComparedFontReady(ready) {
    set({ comparedRenderReady: ready });
  },
}));
