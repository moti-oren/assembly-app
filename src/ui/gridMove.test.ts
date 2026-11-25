import { describe, expect, it } from 'vitest';
import { gridMove } from './gridMove';

describe('gridMove', () => {
  // Two rows of eight bytes; a byte is told by its place, from 0.
  const move = (key: string, at: number) => gridMove(key, at, 8, 2);

  it('moves a byte at a time, and a row at a time', () => {
    expect(move('ArrowRight', 0)).toBe(1);
    expect(move('ArrowDown', 1)).toBe(9);
    expect(move('ArrowUp', 9)).toBe(1);
    expect(move('ArrowLeft', 1)).toBe(0);
  });

  it('goes to the ends of a row with Home and End', () => {
    expect(move('Home', 11)).toBe(8);
    expect(move('End', 2)).toBe(7);
  });

  it('stays among the bytes on show, and ignores other keys', () => {
    expect(move('ArrowLeft', 0)).toBe(0);
    expect(move('ArrowDown', 10)).toBe(15);
    expect(move('Enter', 0)).toBeNull();
  });
});
