import { describe, expect, it } from 'vitest';
import { solveArithmetic } from '@/core/representation/arithmetic';
import { angleOf, bitsAt, journeyKey, WHEEL_SIZE, wheelOf } from './numbersWheel';

const wheels = (kind: 'add' | 'subtract', a: number, b: number, width: 8 | 16 | 32 = 8) => {
  const solution = solveArithmetic({ kind, width, a, b, extra: 0 });
  return {
    unsigned: wheelOf(solution.unsigned, width),
    signed: wheelOf(solution.signed, width)
  };
};

describe('angleOf', () => {
  it('puts the same bits at the same place, whatever they are read as', () => {
    expect(angleOf(0xff, 8)).toBe(angleOf(-1, 8));
  });

  it('leaves the top and the bottom of the ring between two values', () => {
    expect(angleOf(0, 8)).toBeGreaterThan(0);
    expect(angleOf(0xff, 8)).toBeLessThan(360);
    expect(angleOf(0x7f, 8)).toBeLessThan(180);
    expect(angleOf(0x80, 8)).toBeGreaterThan(180);
  });
});

describe('bitsAt', () => {
  it('finds the value a point of the ring stands for', () => {
    const centre = WHEEL_SIZE / 2;
    expect(bitsAt({ x: centre + 50, y: centre }, 8)).toBe(64);
    expect(bitsAt({ x: centre - 1, y: centre + 50 }, 8)).toBe(128);
    expect(bitsAt({ x: centre - 1, y: centre - 50 }, 8)).toBe(255);
  });
});

describe('wheelOf', () => {
  it('crosses the signed seam only, for 127 + 1', () => {
    const { unsigned, signed } = wheels('add', 0x7f, 1);
    expect(unsigned.seam.crossed).toBe(false);
    expect(signed.seam.crossed).toBe(true);
  });

  it('crosses the unsigned seam only, for 255 + 1', () => {
    const { unsigned, signed } = wheels('add', 0xff, 1);
    expect(unsigned.seam.crossed).toBe(true);
    expect(signed.seam.crossed).toBe(false);
  });

  it('starts both journeys at the same place', () => {
    const { unsigned, signed } = wheels('subtract', 3, 5);
    expect(unsigned.start).toEqual(signed.start);
  });

  it('labels the seam with the two numbers it lies between', () => {
    const { unsigned, signed } = wheels('add', 1, 1);
    expect(unsigned.marks[0].label).toBe('255 | 0');
    expect(signed.marks[2].label).toBe('−128 | 127');
    expect(signed.marks[3].label).toBe('−64');
  });

  it('writes the marks of a 32-bit wheel as powers of two', () => {
    const { unsigned, signed } = wheels('add', 1, 1, 32);
    expect(unsigned.marks.map((mark) => mark.label)).toEqual(['2³²−1 | 0', '2³⁰', '2³¹', '3·2³⁰']);
    expect(signed.marks[2].label).toBe('−2³¹ | 2³¹−1');
  });

  it('draws a journey too short to see longer than it is, and says so', () => {
    expect(wheels('add', 5, 3, 32).unsigned.stretched).toBe(true);
    expect(wheels('add', 5, 100).unsigned.stretched).toBe(false);
  });

  it('draws no journey when nothing is added', () => {
    const { unsigned } = wheels('add', 5, 0);
    expect(unsigned.path).toBe('');
    expect(unsigned.end).toEqual(unsigned.start);
  });

  it('writes the signed seam with the top of the scale on the right, where its values lie', () => {
    const { signed } = wheels('add', 0x7f, 1);
    const seam = signed.marks.find((mark) => mark.label.includes('|'))!;
    expect(seam.label).toBe('−128 | 127');
    // 127 lies just right of the seam, and the answer −128 just left of it.
    expect(signed.start.x).toBeGreaterThan(WHEEL_SIZE / 2);
    expect(signed.end.x).toBeLessThan(WHEEL_SIZE / 2);
  });

  it('keeps a short journey that fits off the seam, even when stretched', () => {
    const { unsigned } = wheels('subtract', 5, 3, 32);
    expect(unsigned.stretched).toBe(true);
    expect(unsigned.seam.crossed).toBe(false);
    // Both ends stay right of the top, where 3 and 5 are.
    expect(unsigned.start.x).toBeGreaterThan(WHEEL_SIZE / 2);
    expect(unsigned.end.x).toBeGreaterThan(WHEEL_SIZE / 2);
  });

  it('still draws a short journey that does not fit over the seam', () => {
    const { unsigned } = wheels('subtract', 0, 1, 32);
    expect(unsigned.seam.crossed).toBe(true);
    expect(unsigned.end.x).toBeLessThan(WHEEL_SIZE / 2);
  });
});

describe('journeyKey', () => {
  const add = { kind: 'add', width: 8, a: 5, b: 3, extra: 0 } as const;

  it('stays the same when only A moves', () => {
    expect(journeyKey({ ...add, a: 200 })).toBe(journeyKey(add));
  });

  it('changes with the operation, B, the one more and the width', () => {
    const keys = [
      add,
      { ...add, kind: 'subtract' as const },
      { ...add, b: 4 },
      { ...add, extra: 1 as const },
      { ...add, width: 16 as const }
    ].map(journeyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
