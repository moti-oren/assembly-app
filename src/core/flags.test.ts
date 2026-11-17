import { describe, expect, it } from 'vitest';
import { FLAGS_MASK, flagBit, isFlagSet } from './flags';

describe('flag bits', () => {
  it('places each flag at its 8086 bit', () => {
    expect(flagBit('CF')).toBe(0x0001);
    expect(flagBit('ZF')).toBe(0x0040);
    expect(flagBit('OF')).toBe(0x0800);
  });

  it('reads a flag out of a FLAGS value', () => {
    expect(isFlagSet(0x0041, 'ZF')).toBe(true);
    expect(isFlagSet(0x0041, 'CF')).toBe(true);
    expect(isFlagSet(0x0041, 'SF')).toBe(false);
  });

  it('masks exactly the nine real flags', () => {
    expect(FLAGS_MASK).toBe(0x0fd5);
  });
});
