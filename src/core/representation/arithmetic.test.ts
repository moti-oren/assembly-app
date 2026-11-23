import { describe, expect, it } from 'vitest';
import { solveArithmetic } from './arithmetic';

describe('solveArithmetic', () => {
  it('wraps the unsigned scale only, past the largest value', () => {
    const solution = solveArithmetic({ kind: 'add', width: 8, a: 0xff, b: 1, extra: 0 });
    expect(solution.result).toBe(0);
    expect(solution.unsigned).toMatchObject({ a: 255, b: 1, exact: 256, shown: 0, fits: false });
    expect(solution.signed).toMatchObject({ a: -1, b: 1, exact: 0, shown: 0, fits: true });
  });

  it('wraps the signed scale only, past the largest positive value', () => {
    const solution = solveArithmetic({ kind: 'add', width: 8, a: 0x7f, b: 1, extra: 0 });
    expect(solution.result).toBe(0x80);
    expect(solution.unsigned).toMatchObject({ exact: 128, shown: 128, fits: true });
    expect(solution.signed).toMatchObject({ exact: 128, shown: -128, fits: false });
  });

  it('borrows when the unsigned difference is below zero', () => {
    const solution = solveArithmetic({ kind: 'subtract', width: 8, a: 3, b: 5, extra: 0 });
    expect(solution.result).toBe(0xfe);
    expect(solution.unsigned).toMatchObject({ exact: -2, shown: 254, fits: false });
    expect(solution.signed).toMatchObject({ exact: -2, shown: -2, fits: true });
  });

  it('counts the carry or borrow coming in', () => {
    expect(solveArithmetic({ kind: 'add', width: 8, a: 1, b: 1, extra: 1 }).result).toBe(3);
    expect(solveArithmetic({ kind: 'subtract', width: 8, a: 1, b: 1, extra: 1 }).result).toBe(0xff);
  });

  it('is exact at 32 bits', () => {
    const solution = solveArithmetic({
      kind: 'add',
      width: 32,
      a: 0xffffffff,
      b: 0xffffffff,
      extra: 1
    });
    expect(solution.result).toBe(0xffffffff);
    expect(solution.unsigned).toMatchObject({ exact: 2 ** 33 - 1, fits: false });
    expect(solution.signed).toMatchObject({ a: -1, b: -1, exact: -1, fits: true });
  });

  it('gives both scales the same bits whatever the operands', () => {
    for (let a = 0; a < 256; a += 17) {
      for (let b = 0; b < 256; b += 13) {
        const { result, unsigned, signed } = solveArithmetic({
          kind: 'subtract',
          width: 8,
          a,
          b,
          extra: 0
        });
        expect(unsigned.shown).toBe(result);
        expect(signed.shown & 0xff).toBe(result);
      }
    }
  });
});
