import { describe, expect, it } from 'vitest';
import { rowNeighbour, type Box } from './gridNavigation';

// Two rows: three wide boxes, then two boxes under the left and the right one.
const boxes: Box[] = [
  { left: 0, top: 0, width: 40 },
  { left: 50, top: 0, width: 40 },
  { left: 100, top: 0, width: 40 },
  { left: 0, top: 30, width: 40 },
  { left: 100, top: 30, width: 40 }
];

describe('rowNeighbour', () => {
  it('moves to the box below, in the nearest column', () => {
    expect(rowNeighbour(boxes, 0, true)).toBe(3);
    expect(rowNeighbour(boxes, 2, true)).toBe(4);
  });

  it('moves up the same way', () => {
    expect(rowNeighbour(boxes, 4, false)).toBe(2);
    expect(rowNeighbour(boxes, 3, false)).toBe(0);
  });

  it('stays put with no row that way', () => {
    expect(rowNeighbour(boxes, 1, false)).toBe(1);
    expect(rowNeighbour(boxes, 3, true)).toBe(3);
  });
});
