import { describe, expect, it } from 'vitest';
import { lineMoveOf, rowAfterRemove } from './programKeys';

const alt = (key: string) => ({ key, altKey: true });

describe('lineMoveOf', () => {
  it('moves a line one place with Alt and an arrow', () => {
    expect(lineMoveOf(alt('ArrowUp'), 2, 4)).toEqual({ from: 2, to: 1 });
    expect(lineMoveOf(alt('ArrowDown'), 2, 4)).toEqual({ from: 2, to: 3 });
  });

  it('stops at the first and the last line', () => {
    expect(lineMoveOf(alt('ArrowUp'), 0, 4)).toBeNull();
    expect(lineMoveOf(alt('ArrowDown'), 3, 4)).toBeNull();
  });

  it('leaves the plain arrows and other keys alone', () => {
    expect(lineMoveOf({ key: 'ArrowUp', altKey: false }, 2, 4)).toBeNull();
    expect(lineMoveOf(alt('Enter'), 2, 4)).toBeNull();
  });

  it('ignores a key that came from no line', () => {
    expect(lineMoveOf(alt('ArrowUp'), Number.NaN, 4)).toBeNull();
    expect(lineMoveOf(alt('ArrowUp'), 4, 4)).toBeNull();
  });
});

describe('rowAfterRemove', () => {
  it('keeps the focus on the line that took the removed one’s place, or the one above', () => {
    expect(rowAfterRemove(1, 3)).toBe(1);
    expect(rowAfterRemove(3, 3)).toBe(2);
    expect(rowAfterRemove(0, 0)).toBeNull();
  });
});
