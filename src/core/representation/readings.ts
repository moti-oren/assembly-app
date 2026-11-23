import { formatBits } from '../shared/numbers';

export type Width = 8 | 16 | 32;

/** The two ways a row of bits is read as a whole number. */
export type Scale = 'unsigned' | 'signed';

/** How many values `width` bits can hold. */
export function span(width: number): number {
  return 2 ** width;
}

/** The bits of any whole number, kept to `width` bits: what a register of that width holds. */
export function wrap(value: number, width: number): number {
  const size = span(width);
  return ((value % size) + size) % size;
}

/** The bits read as a two's complement number: the top bit counts as minus its weight. */
export function signedOf(bits: number, width: number): number {
  const value = wrap(bits, width);
  return value >= span(width - 1) ? value - span(width) : value;
}

export function readAs(bits: number, width: number, scale: Scale): number {
  return scale === 'signed' ? signedOf(bits, width) : wrap(bits, width);
}

export interface Range {
  min: number;
  max: number;
}

/** The numbers `width` bits can hold on a scale. */
export function rangeOf(width: number, scale: Scale): Range {
  return scale === 'signed'
    ? { min: -span(width - 1), max: span(width - 1) - 1 }
    : { min: 0, max: span(width) - 1 };
}

/** True when both digits of a byte are 0 to 9, so it is a packed decimal number. */
export function isDecimalByte(byte: number): boolean {
  return (byte & 0x0f) <= 9 && byte >> 4 <= 9;
}

/** A packed decimal byte as the number its two digits spell: 0x42 is 42. */
export function decimalOf(byte: number): number {
  return (byte >> 4) * 10 + (byte & 0x0f);
}

/** Everything one row of bits can be taken to mean. */
export interface ValueReadings {
  width: Width;
  bits: number;
  binary: string;
  hex: string;
  unsigned: number;
  signed: number;
  /** Each byte as a printable ASCII character, high byte first; null where there is none. */
  characters: (string | null)[];
  /** Each byte as two decimal digits, high byte first; null where a digit is past 9. */
  decimal: (number | null)[];
}

function bytesOf(bits: number, width: Width): number[] {
  const bytes: number[] = [];
  for (let shift = width - 8; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bits / span(shift)) % 0x100);
  }
  return bytes;
}

export function readValue(value: number, width: Width): ValueReadings {
  const bits = wrap(value, width);
  const bytes = bytesOf(bits, width);
  return {
    width,
    bits,
    binary: formatBits(bits, width),
    hex: bits
      .toString(16)
      .toUpperCase()
      .padStart(width / 4, '0'),
    unsigned: bits,
    signed: signedOf(bits, width),
    characters: bytes.map((byte) =>
      byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : null
    ),
    decimal: bytes.map((byte) => (isDecimalByte(byte) ? decimalOf(byte) : null))
  };
}
