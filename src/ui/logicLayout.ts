/**
 * Where a bit's column sits in the rows of the circuit. The top bit is on the left, as a number
 * is written, and every fourth column is set apart so the bits read as hex digits. Lengths are
 * in units of a quarter of a column.
 */
export const COLUMN_UNITS = 4;
const GAP_UNITS = 1;

/** The column of a bit, counting from the left. */
export function columnOf(width: number, bit: number): number {
  return width - 1 - bit;
}

/** Whether a gap comes before the bit's column: it is the top bit of a hex digit. */
export function startsDigit(width: number, bit: number): boolean {
  const column = columnOf(width, bit);
  return column > 0 && column % 4 === 0;
}

/** The left edge of a bit's column. */
function columnLeft(width: number, bit: number): number {
  const column = columnOf(width, bit);
  return column * COLUMN_UNITS + Math.floor(column / 4) * GAP_UNITS;
}

/** The middle of a bit's column. */
export function columnCentre(width: number, bit: number): number {
  return columnLeft(width, bit) + COLUMN_UNITS / 2;
}

/** The width of a row of `width` columns. */
export function rowUnits(width: number): number {
  return columnLeft(width, 0) + COLUMN_UNITS;
}

/** The bits of a row in the order they are drawn: the top bit first. */
export function bitsLeftToRight(width: number): number[] {
  return Array.from({ length: width }, (_, column) => width - 1 - column);
}

/**
 * A row of bits as one thing to hear, the top bit first in groups of four, as it is drawn: a
 * screen reader that met every bit by itself would hear 32 images for one number.
 */
export function rowSaid(name: string, bits: readonly number[]): string {
  const groups: string[] = [];
  for (const bit of bitsLeftToRight(bits.length)) {
    if (groups.length === 0 || startsDigit(bits.length, bit)) groups.push('');
    groups[groups.length - 1] += String(bits[bit]);
  }
  return `${name}: ${groups.join(' ')}`;
}
