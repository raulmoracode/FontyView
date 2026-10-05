export interface BinaryRegion {
  offset: number;
  length: number;
}

/**
 * Bounds-checked big-endian reader. Every font table is big-endian, so this is
 * the only byte order the parsers need; EOT and compressed payloads are
 * unpacked before they reach a table parser.
 */
export class BinaryReader {
  readonly view: DataView;
  readonly bytes: Uint8Array;
  readonly base: number;
  readonly length: number;

  private cursor: number;

  constructor(source: ArrayBuffer | Uint8Array, region?: BinaryRegion) {
    const isView = source instanceof Uint8Array;
    const buffer = isView
      ? source.buffer.slice(
          source.byteOffset,
          source.byteOffset + source.byteLength,
        )
      : source;

    const offset = region?.offset ?? 0;
    const size = region?.length ?? buffer.byteLength - offset;

    if (offset < 0 || size < 0 || offset + size > buffer.byteLength) {
      throw new RangeError(
        `Binary region out of bounds (offset ${offset}, length ${size}, buffer ${buffer.byteLength})`,
      );
    }

    this.base = offset;
    this.length = size;
    this.bytes = new Uint8Array(buffer, offset, size);
    this.view = new DataView(buffer, offset, size);
    this.cursor = 0;
  }

  get position(): number {
    return this.cursor;
  }

  get remaining(): number {
    return this.length - this.cursor;
  }

  seek(position: number): this {
    if (position < 0 || position > this.length) {
      throw new RangeError(
        `Seek out of bounds (position ${position}, length ${this.length})`,
      );
    }
    this.cursor = position;
    return this;
  }

  skip(count: number): this {
    return this.seek(this.cursor + count);
  }

  private require(count: number): void {
    if (count < 0 || this.cursor + count > this.length) {
      throw new RangeError(
        `Unexpected end of data (need ${count} bytes at ${this.cursor}, have ${this.remaining})`,
      );
    }
  }

  uint8(): number {
    this.require(1);
    return this.view.getUint8(this.cursor++);
  }

  int8(): number {
    this.require(1);
    return this.view.getInt8(this.cursor++);
  }

  uint16(): number {
    this.require(2);
    const value = this.view.getUint16(this.cursor);
    this.cursor += 2;
    return value;
  }

  int16(): number {
    this.require(2);
    const value = this.view.getInt16(this.cursor);
    this.cursor += 2;
    return value;
  }

  uint24(): number {
    this.require(3);
    const value =
      (this.view.getUint8(this.cursor) << 16) |
      (this.view.getUint8(this.cursor + 1) << 8) |
      this.view.getUint8(this.cursor + 2);
    this.cursor += 3;
    return value;
  }

  uint32(): number {
    this.require(4);
    const value = this.view.getUint32(this.cursor);
    this.cursor += 4;
    return value;
  }

  int32(): number {
    this.require(4);
    const value = this.view.getInt32(this.cursor);
    this.cursor += 4;
    return value;
  }

  /** 64-bit signed integer as a JS number. Safe: font dates fit in 2^53. */
  int64(): number {
    const high = this.int32();
    const low = this.uint32();
    return high * 0x1_0000_0000 + low;
  }

  /** 16.16 fixed point. */
  fixed(): number {
    return this.int32() / 65536;
  }

  /** 2.14 fixed point, as used by variation coordinates. */
  f2dot14(): number {
    return this.int16() / 16384;
  }

  /** Four character table tag, e.g. `head`, `OS/2`. */
  tag(): string {
    this.require(4);
    let out = "";
    for (let i = 0; i < 4; i++) {
      out += String.fromCharCode(this.view.getUint8(this.cursor + i));
    }
    this.cursor += 4;
    return out;
  }

  readBytes(count: number): Uint8Array {
    this.require(count);
    const out = this.bytes.subarray(this.cursor, this.cursor + count);
    this.cursor += count;
    return out;
  }

  /** Length-prefixed pascal string padded to a multiple of `padTo`. */
  pascalString(padTo: number): string {
    const length = this.uint8();
    const raw = this.readBytes(length);
    const padding = padTo > 0 ? (padTo - ((length + 1) % padTo)) % padTo : 0;
    if (padding > 0) this.skip(padding);
    let out = "";
    for (const byte of raw) out += String.fromCharCode(byte);
    return out;
  }

  /** UTF-16BE string of `charCount` code units. */
  utf16be(charCount: number): string {
    let out = "";
    for (let i = 0; i < charCount; i++)
      out += String.fromCharCode(this.uint16());
    return out;
  }

  /** A 16/32-bit offset relative to the start of this region. */
  offset(size: 1 | 2 | 4): number {
    return size === 1
      ? this.uint8()
      : size === 2
        ? this.uint16()
        : this.uint32();
  }

  /** Resolves an offset stored inside this region to a nested reader. */
  sub(relativeOffset: number, length?: number): BinaryReader {
    const size = length ?? this.length - relativeOffset;
    return new BinaryReader(this.bytes, {
      offset: relativeOffset,
      length: size,
    });
  }

  /** Raw copy of a region, used to expose table bytes without aliasing. */
  copy(relativeOffset: number, length: number): Uint8Array {
    if (
      relativeOffset < 0 ||
      length < 0 ||
      relativeOffset + length > this.length
    ) {
      throw new RangeError("Sub-region out of bounds");
    }
    return this.bytes.slice(relativeOffset, relativeOffset + length);
  }
}
