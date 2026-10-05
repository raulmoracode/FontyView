declare module "wawoff2" {
  /** WOFF2 encoder, used only to generate test fixtures. */
  export function compress(input: Uint8Array): Promise<Uint8Array>;
  export function decompress(input: Uint8Array): Promise<Uint8Array>;
}
