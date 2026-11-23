import { describe, expect, it } from 'vitest';
import { isLandable, morphBetween } from './splash';

describe('morphBetween', () => {
  it('moves centre to centre and scales by the widths', () => {
    const chip = { left: 600, top: 340, width: 156, height: 156 };
    const mark = { left: 19, top: 11, width: 26, height: 26 };
    const { x, y, scale } = morphBetween(chip, mark);
    expect([x, y]).toEqual([-646, -394]);
    expect(scale).toBeCloseTo(1 / 6, 10);
  });

  it('keeps fractions, so the landing is not rounded off', () => {
    const chip = { left: 100.25, top: 50.5, width: 112.3125, height: 112.3125 };
    const mark = { left: 16.5, top: 10.75, width: 26, height: 26 };
    const { x, y, scale } = morphBetween(chip, mark);
    expect(x).toBeCloseTo(29.5 - 156.40625, 10);
    expect(y).toBeCloseTo(23.75 - 106.65625, 10);
    expect(scale).toBeCloseTo(26 / 112.3125, 10);
  });

  it('is the identity between equal boxes', () => {
    const box = { left: 3, top: 4, width: 26, height: 26 };
    expect(morphBetween(box, box)).toEqual({ x: 0, y: 0, scale: 1 });
  });
});

describe('isLandable', () => {
  it('needs a box with a size', () => {
    expect(isLandable({ left: 0, top: 0, width: 26, height: 26 })).toBe(true);
    expect(isLandable({ left: 0, top: 0, width: 0, height: 0 })).toBe(false);
    expect(isLandable({ left: 10, top: 10, width: 26, height: 0 })).toBe(false);
  });
});
