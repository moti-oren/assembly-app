import { describe, expect, it } from 'vitest';
import { solveScaling, type ScalingRequest } from './scaling';

const shift = (
  value: number,
  direction: ScalingRequest['direction'],
  count = 1,
  fill: ScalingRequest['fill'] = 'zero',
  width: ScalingRequest['width'] = 8
) => solveScaling({ kind: 'shift', width, value, direction, fill, count });

describe('solveScaling', () => {
  it('doubles on both scales while the answer fits', () => {
    const { result, scales } = shift(0x15, 'left');
    expect(result).toBe(0x2a);
    expect(scales.unsigned).toMatchObject({ value: 21, exact: 42, shown: 42, fits: true });
    expect(scales.signed).toMatchObject({ value: 21, exact: 42, agrees: true });
  });

  it('doubles a negative number, which the unsigned scale reads as too large', () => {
    const { result, scales } = shift(0xfd, 'left');
    expect(result).toBe(0xfa);
    expect(scales.signed).toMatchObject({ value: -3, exact: -6, shown: -6, agrees: true });
    expect(scales.unsigned).toMatchObject({ exact: 506, shown: 250, fits: false, agrees: false });
  });

  it('says when a doubling leaves the signed range', () => {
    const { scales } = shift(0x40, 'left');
    expect(scales.unsigned).toMatchObject({ exact: 128, fits: true, agrees: true });
    expect(scales.signed).toMatchObject({ exact: 128, shown: -128, fits: false, agrees: false });
  });

  it('halves an unsigned number with zeros, rounding down', () => {
    const { result, scales } = shift(0xf9, 'right');
    expect(result).toBe(0x7c);
    expect(scales.unsigned).toMatchObject({ value: 249, exact: 124, remainder: 1, agrees: true });
    // −7 halved is −4, but with a zero in the top place the bits read +124.
    expect(scales.signed).toMatchObject({ value: -7, exact: -4, shown: 124, agrees: false });
  });

  it('halves a signed number by copying the top bit, rounding down and not toward zero', () => {
    const { result, scales } = shift(0xf9, 'right', 1, 'sign');
    expect(result).toBe(0xfc);
    expect(scales.signed).toMatchObject({ value: -7, exact: -4, remainder: 1, shown: -4 });
    expect(scales.signed.agrees).toBe(true);
    expect(scales.unsigned).toMatchObject({ exact: 124, shown: 252, agrees: false });
  });

  it('agrees on both scales for a number that is not negative, whatever the fill', () => {
    for (const fill of ['zero', 'sign'] as const) {
      const { scales } = shift(0x50, 'right', 3, fill);
      expect(scales.unsigned).toMatchObject({ exact: 10, remainder: 0, agrees: true });
      expect(scales.signed).toMatchObject({ exact: 10, agrees: true });
    }
  });

  it('moves several places at once', () => {
    expect(shift(0x03, 'left', 4).result).toBe(0x30);
    expect(shift(0x8000, 'right', 15, 'sign', 16).result).toBe(0xffff);
    expect(shift(0x80000000, 'right', 31, 'zero', 32).result).toBe(1);
    expect(shift(0x00000001, 'left', 31, 'zero', 32).result).toBe(0x80000000);
  });

  it('leaves the value as it is for no places', () => {
    const { result, scales } = shift(0x9c, 'right', 0, 'sign');
    expect(result).toBe(0x9c);
    expect(scales.signed.agrees).toBe(true);
    expect(scales.unsigned.agrees).toBe(true);
  });

  it('runs out of bits when asked for more places than there are', () => {
    expect(shift(0xff, 'left', 8).result).toBe(0);
    expect(shift(0xff, 'left', 200).result).toBe(0);
    expect(shift(0xff, 'right', 9).result).toBe(0);
    expect(shift(0x80, 'right', 200, 'sign').result).toBe(0xff);
    expect(shift(0x7f, 'right', 200, 'sign').result).toBe(0);
  });

  it('gives the bits a real shift gives, for every byte and count', () => {
    for (let value = 0; value < 0x100; value++) {
      for (let count = 0; count <= 9; count++) {
        const signed = (value << 24) >> 24;
        expect(shift(value, 'left', count).result).toBe(count > 31 ? 0 : (value << count) & 0xff);
        expect(shift(value, 'right', count).result).toBe(value >>> count);
        expect(shift(value, 'right', count, 'sign').result).toBe((signed >> count) & 0xff);
      }
    }
  });
});
