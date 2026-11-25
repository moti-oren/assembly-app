import { describe, expect, it } from 'vitest';
import {
  bitsLeftToRight,
  columnCentre,
  columnOf,
  COLUMN_UNITS,
  rowSaid,
  rowUnits,
  startsDigit
} from './logicLayout';

describe('logicLayout', () => {
  it('puts the top bit in the first column', () => {
    expect(columnOf(8, 7)).toBe(0);
    expect(columnOf(8, 0)).toBe(7);
    expect(bitsLeftToRight(4)).toEqual([3, 2, 1, 0]);
  });

  it('sets every hex digit apart, but not the first', () => {
    expect([7, 6, 5, 4, 3, 2, 1, 0].filter((bit) => startsDigit(8, bit))).toEqual([3]);
    expect(startsDigit(16, 11)).toBe(true);
    expect(startsDigit(16, 15)).toBe(false);
  });

  it('counts the gaps into where a column sits', () => {
    expect(columnCentre(8, 7)).toBe(COLUMN_UNITS / 2);
    // Four columns and one gap to the left of bit 3.
    expect(columnCentre(8, 3)).toBe(4 * COLUMN_UNITS + 1 + COLUMN_UNITS / 2);
    expect(rowUnits(8)).toBe(8 * COLUMN_UNITS + 1);
    expect(rowUnits(32)).toBe(32 * COLUMN_UNITS + 7);
  });
});

describe('rowSaid', () => {
  it('reads a row top bit first, in groups of four', () => {
    // Bit 0 first in the array: 0b0110_0001.
    expect(rowSaid('PC', [1, 0, 0, 0, 0, 1, 1, 0])).toBe('PC: 0110 0001');
  });
});
