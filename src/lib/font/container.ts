import { BinaryReader } from "./binary-reader";
import { FontAnalysisError } from "./errors";

const SFNT_TRUETYPE = 0x0001_0000;
const SFNT_TRUE = 0x7472_7565; // "true"
const SFNT_TYP1 = 0x7479_7031; // "typ1"
const SFNT_OTTO = 0x4f54_544f; // "OTTO"
const SFNT_TTCF = 0x7474_6366; // "ttcf"
const SFNT_OTCF = 0x4f54_4346; // "OTCF"
const SFNT_WOFF = 0x774f_4646; // "wOFF"
const SFNT_WOF2 = 0x774f_4632; // "wOF2"

export type ContainerFormat = "ttf" | "otf" | "woff" | "woff2" | "ttc" | "otc";

export interface ContainerInfo {
  format: ContainerFormat;
  /** Container name as shown in the interface, e.g. `WOFF2`. */
  label: string;
  /** sfnt flavour: `0x00010000`, `'OTTO'`, `'true'` or `'typ1'`. */
  flavor: number;
  /** Number of fonts inside a TTC/OTC, otherwise `undefined`. */
  fontCount?: number;
}

export type OutlineFormat = "truetype" | "cff" | "cff2";

export interface SfntTableRecord {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

export interface SfntDirectory {
  flavor: number;
  tables: SfntTableRecord[];
}

export interface TablePayload {
  tag: string;
  data: Uint8Array;
}

/**
 * Reads the container flavour from the leading signature. Nothing is trusted
 * from the file name or the MIME type the browser reports.
 */
export function readContainerInfo(bytes: Uint8Array): ContainerInfo {
  if (bytes.byteLength === 0) {
    throw new FontAnalysisError("empty-file");
  }

  if (bytes.byteLength < 12) {
    throw new FontAnalysisError("not-a-font");
  }

  const signature = viewOf(bytes).getUint32(0);

  switch (signature) {
    case SFNT_TRUETYPE:
    case SFNT_TRUE:
    case SFNT_TYP1:
      return { format: "ttf", label: "TrueType", flavor: signature };
    case SFNT_OTTO:
      return { format: "otf", label: "OpenType", flavor: SFNT_OTTO };
    case SFNT_WOFF:
      return {
        format: "woff",
        label: "WOFF",
        flavor: viewOf(bytes).getUint32(4),
      };
    case SFNT_WOF2:
      return {
        format: "woff2",
        label: "WOFF2",
        flavor: viewOf(bytes).getUint32(4),
      };
    case SFNT_TTCF:
    case SFNT_OTCF: {
      const fontCount = new BinaryReader(bytes).seek(8).uint32();
      if (fontCount === 0) {
        throw new FontAnalysisError("collection-empty");
      }
      const isOtc = signature === SFNT_OTCF;
      return {
        format: isOtc ? "otc" : "ttc",
        label: isOtc ? "OpenType Collection" : "TrueType Collection",
        flavor: isOtc ? SFNT_OTTO : SFNT_TRUETYPE,
        fontCount,
      };
    }
    default:
      throw new FontAnalysisError("unsupported-format");
  }
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function readSfntDirectory(bytes: Uint8Array): SfntDirectory {
  const reader = new BinaryReader(bytes);
  const flavor = reader.uint32();
  const numTables = reader.uint16();
  reader.skip(6);

  const tables: SfntTableRecord[] = [];
  for (let i = 0; i < numTables; i++) {
    tables.push({
      tag: reader.tag(),
      checksum: reader.uint32(),
      offset: reader.uint32(),
      length: reader.uint32(),
    });
  }

  for (const table of tables) {
    if (table.offset + table.length > bytes.byteLength) {
      throw new FontAnalysisError("corrupted", `table ${table.tag}`);
    }
  }

  return { flavor, tables };
}

/** Serialises table payloads into a standalone sfnt buffer. */
export function buildSfnt(
  flavor: number,
  payloads: TablePayload[],
): ArrayBuffer {
  // sfnt requires tables in ascending tag order.
  const sorted = [...payloads].sort((a, b) =>
    a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0,
  );

  const numTables = sorted.length;
  const entrySelector = Math.floor(Math.log2(Math.max(numTables, 1)));
  const searchRange = 2 ** entrySelector * 16;
  const rangeShift = numTables * 16 - searchRange;

  const directorySize = 12 + numTables * 16;
  let total = directorySize;
  for (const table of sorted) {
    total += table.data.byteLength;
    total += (4 - (table.data.byteLength % 4)) % 4;
  }

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, flavor);
  view.setUint16(4, numTables);
  view.setUint16(6, searchRange);
  view.setUint16(8, entrySelector);
  view.setUint16(10, rangeShift);

  let cursor = directorySize;
  sorted.forEach((table, index) => {
    const entry = directorySize - numTables * 16 + index * 16;
    for (let i = 0; i < 4; i++) {
      out[entry + i] = table.tag.charCodeAt(i);
    }
    view.setUint32(entry + 4, 0);
    view.setUint32(entry + 8, cursor);
    view.setUint32(entry + 12, table.data.byteLength);
    out.set(table.data, cursor);
    cursor += table.data.byteLength;
    cursor += (4 - (table.data.byteLength % 4)) % 4;
  });

  return out.buffer;
}

/** Reads one font out of a TTC/OTC as a standalone sfnt buffer. */
export function extractFromCollection(
  bytes: Uint8Array,
  index = 0,
): ArrayBuffer {
  const header = new BinaryReader(bytes);
  header.seek(8);
  const fontCount = header.uint32();
  if (index >= fontCount) {
    throw new FontAnalysisError("collection-empty");
  }
  header.seek(12 + index * 4);
  const directoryOffset = header.uint32();

  const reader = new BinaryReader(bytes).seek(directoryOffset);
  const flavor = reader.uint32();
  const numTables = reader.uint16();
  reader.skip(6);

  const payloads: TablePayload[] = [];
  for (let i = 0; i < numTables; i++) {
    const tag = reader.tag();
    reader.skip(4);
    const offset = reader.uint32();
    const length = reader.uint32();
    payloads.push({ tag, data: bytes.subarray(offset, offset + length) });
  }

  return buildSfnt(flavor, payloads);
}

export interface WoffEntry {
  tag: string;
  offset: number;
  compLength: number;
  origLength: number;
}

async function inflate(
  bytes: Uint8Array,
  offset: number,
  compLength: number,
  origLength: number,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new FontAnalysisError(
      "unsupported-format",
      "DecompressionStream unavailable",
    );
  }
  const slice = bytes.subarray(offset, offset + compLength);
  const stream = new Blob([slice.slice() as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const output = new Uint8Array(await new Response(stream).arrayBuffer());
  if (output.byteLength !== origLength) {
    throw new FontAnalysisError("corrupted", "WOFF table length mismatch");
  }
  return output;
}

/** Unpacks a WOFF container into a plain sfnt buffer. */
export async function decodeWoff(bytes: Uint8Array): Promise<ArrayBuffer> {
  const reader = new BinaryReader(bytes);
  reader.seek(4);
  const flavor = reader.uint32();
  reader.uint32(); // declared file length
  const numTables = reader.uint16();
  reader.skip(2 + 4 + 4 + 2 + 2 + 4 + 4 + 4 + 4);

  const entries: WoffEntry[] = [];
  for (let i = 0; i < numTables; i++) {
    entries.push({
      tag: reader.tag(),
      offset: reader.uint32(),
      compLength: reader.uint32(),
      origLength: reader.uint32(),
    });
    reader.uint32(); // origChecksum
  }

  const payloads: TablePayload[] = [];
  for (const entry of entries) {
    if (entry.offset + entry.compLength > bytes.byteLength) {
      throw new FontAnalysisError("corrupted", `WOFF table ${entry.tag}`);
    }
    const data =
      entry.compLength === entry.origLength
        ? bytes.slice(entry.offset, entry.offset + entry.compLength)
        : await inflate(
            bytes,
            entry.offset,
            entry.compLength,
            entry.origLength,
          );
    payloads.push({ tag: entry.tag, data });
  }

  return buildSfnt(flavor, payloads);
}

/** Resolves the outline flavour from the table list of an unpacked font. */
export function readOutlineFormat(tables: SfntTableRecord[]): OutlineFormat {
  const tags = new Set(tables.map((table) => table.tag));
  if (tags.has("glyf")) return "truetype";
  if (tags.has("CFF2")) return "cff2";
  if (tags.has("CFF ")) return "cff";
  throw new FontAnalysisError("not-a-font", "no outline table");
}
