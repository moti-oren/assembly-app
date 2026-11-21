import { describe, expect, it } from 'vitest';
import { HEAT_STEPS, warmth } from './memoryHeat';

describe('warmth', () => {
  const heat = new Map([
    [0x10, 0],
    [0x11, 1],
    [0x12, HEAT_STEPS - 1]
  ]);

  it('leaves the last write and unwritten bytes to their panel', () => {
    expect(warmth(heat, 0x10)).toBeUndefined();
    expect(warmth(heat, 0x20)).toBeUndefined();
  });

  it('cools down with age', () => {
    expect(warmth(heat, 0x11)).toBe('color-mix(in oklch, var(--changed) 58%, transparent)');
    expect(warmth(heat, 0x12)).toBe('color-mix(in oklch, var(--changed) 12%, transparent)');
  });
});
