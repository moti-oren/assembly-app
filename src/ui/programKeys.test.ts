import { describe, expect, it } from 'vitest';
import { lineMoveOf } from './programKeys';

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
