import init, { decompress } from "brotli-dec-wasm/web";
import wasmUrl from "brotli-dec-wasm/web/bg.wasm?url";
import { FontAnalysisError } from "./errors";

export type BrotliDecompressor = (data: Uint8Array) => Uint8Array;

let pending: Promise<BrotliDecompressor> | null = null;

/**
 * Instantiates the Brotli WASM decoder once per session. The asset is imported
 * through Vite so it is hashed and served correctly in both dev and production.
 */
export function loadBrotliDecompressor(): Promise<BrotliDecompressor> {
  pending ??= init({ module_or_path: wasmUrl })
    .then(() => decompress)
    .catch((cause: unknown) => {
      pending = null;
      throw new FontAnalysisError(
        "woff2-unavailable",
        cause instanceof Error ? cause.message : undefined,
      );
    });
  return pending;
}
