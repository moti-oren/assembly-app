/**
 * 32-bit arithmetic in JavaScript. Bitwise operators already work on 32 bits but give signed
 * results, so every register value is kept unsigned with `u32` and read as signed with `s32`.
 */

export function u32(value: number): number {
  return value >>> 0;
}

export function s32(value: number): number {
  return value | 0;
}

/** Sign-extends the low `bits` bits of `value` to 32 bits, as the CPU does with immediates. */
export function signExtend(value: number, bits: number): number {
  const shift = 32 - bits;
  return u32((value << shift) >> shift);
}

/** True when `value` fits in `bits` bits as a two's complement signed number. */
export function fitsSigned(value: number, bits: number): boolean {
  return Number.isInteger(value) && value >= -(2 ** (bits - 1)) && value < 2 ** (bits - 1);
}

export function fitsUnsigned(value: number, bits: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < 2 ** bits;
}

/** Bits `high` down to `low` of `value`, as an unsigned number: `field(word, 6, 0)` is the opcode. */
export function field(value: number, high: number, low: number): number {
  const width = high - low + 1;
  return width === 32 ? u32(value) : (value >>> low) & (2 ** width - 1);
}

export function formatHex32(value: number): string {
  return u32(value).toString(16).toUpperCase().padStart(8, '0');
}
