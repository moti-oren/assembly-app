export type Size = 8 | 16;

export function mask(size: Size): number {
  return size === 8 ? 0xff : 0xffff;
}

export function signBit(size: Size): number {
  return size === 8 ? 0x80 : 0x8000;
}

/** Keeps the low `size` bits. Negative numbers become their two's complement form. */
export function truncate(value: number, size: Size): number {
  return value & mask(size);
}

/** Interprets the low `size` bits as a two's complement signed number. */
export function toSigned(value: number, size: Size): number {
  const unsigned = truncate(value, size);
  return unsigned & signBit(size) ? unsigned - (mask(size) + 1) : unsigned;
}

/** Joins bytes stored low byte first, as the 8086 stores a word, into one number. */
export function littleEndian(bytes: readonly number[]): number {
  return bytes.reduce((value, byte, i) => value | (byte << (8 * i)), 0);
}

/** True when the low byte has an even number of set bits (the 8086 PF rule). */
export function hasEvenParity(value: number): boolean {
  let v = value & 0xff;
  v ^= v >> 4;
  v ^= v >> 2;
  v ^= v >> 1;
  return (v & 1) === 0;
}

/** True when `value` can be written as a `size`-bit number, signed or unsigned. */
export function fitsIn(value: number, size: Size): boolean {
  return Number.isInteger(value) && value >= -signBit(size) && value <= mask(size);
}

/**
 * Parses the number formats an assembly programmer is likely to type:
 * `42`, `-5`, `0x2A`, `2Ah`, `$2A` (as 6502 code writes it), `0b101010`, `101010b`.
 */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().toLowerCase().replace(/_/g, '');
  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;

  let value: number;
  if (/^0x[0-9a-f]+$/.test(body)) {
    value = parseInt(body.slice(2), 16);
  } else if (/^\$[0-9a-f]+$/.test(body)) {
    value = parseInt(body.slice(1), 16);
  } else if (/^0b[01]+$/.test(body)) {
    value = parseInt(body.slice(2), 2);
  } else if (/^[0-9][0-9a-f]*h$/.test(body)) {
    value = parseInt(body.slice(0, -1), 16);
  } else if (/^[01]+b$/.test(body)) {
    value = parseInt(body.slice(0, -1), 2);
  } else if (/^[0-9]+$/.test(body)) {
    value = parseInt(body, 10);
  } else {
    return null;
  }

  return negative ? -value : value;
}

export function formatHex(value: number, size: Size): string {
  return truncate(value, size)
    .toString(16)
    .toUpperCase()
    .padStart(size / 4, '0');
}

/** A bit field of `width` bits, e.g. the 3-bit `reg` field of a ModR/M byte. */
export function formatBits(value: number, width: number): string {
  return value.toString(2).padStart(width, '0');
}

/** Bytes in hex, separated by spaces, the way machine code is written. */
export function formatBytes(bytes: readonly number[]): string {
  return bytes.map((byte) => formatHex(byte, 8)).join(' ');
}

export function formatBinary(value: number, size: Size): string {
  const bits = truncate(value, size).toString(2).padStart(size, '0');
  return bits.replace(/(.{4})(?=.)/g, '$1 ');
}

/** A number written in hex as an instruction writes it: `0x1F`, in capitals. */
export function hexLiteral(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

/**
 * A number in hex as Intel's 8086 listings write it: `2Ah`, with a 0 in front of a first digit
 * that is a letter (`0FFh`), so it cannot be read as a name.
 */
export function hexSuffixed(value: number, size?: Size): string {
  const digits = size ? formatHex(value, size) : value.toString(16).toUpperCase();
  return `${/^[A-F]/.test(digits) ? '0' : ''}${digits}h`;
}

/**
 * An instruction's number as it reads best: up to 255 (and below 0) in decimal, as it is mostly
 * typed, larger in hex.
 */
export function immediateText(value: number, hex: (value: number) => string = hexLiteral): string {
  return value < 256 ? String(value) : hex(value);
}

/**
 * A number that stands for bits or a code rather than an amount (an interrupt's, LUI's upper
 * bits): in hex from 10 up, as every listing writes it.
 */
export function codeText(value: number, hex: (value: number) => string = hexLiteral): string {
  return value < 10 ? String(value) : hex(value);
}
