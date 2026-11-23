import { describe, expect, it } from 'vitest';
import { solveBcd } from './bcd';

describe('solveBcd', () => {
  it('adds without a correction when each digit stays a digit', () => {
    const solution = solveBcd({ kind: 'bcd', operation: 'add', a: 0x12, b: 0x34, extra: 0 });
    expect(solution.result).toBe(0x46);
    expect(solution.out).toBe(0);
    expect(solution.digits.map((digit) => digit.corrected)).toEqual([false, false]);
    expect(solution.decimal).toEqual({ a: 12, b: 34, exact: 46, shown: 46 });
  });

  it('adds 6 to a digit past 9 and carries into the next', () => {
    const solution = solveBcd({ kind: 'bcd', operation: 'add', a: 0x19, b: 0x03, extra: 0 });
    const [ones, tens] = solution.digits;
    expect(ones).toMatchObject({ raw: 12, corrected: true, digit: 2, out: 1 });
    expect(tens).toMatchObject({ extra: 1, raw: 2, corrected: false, digit: 2 });
    expect(solution.result).toBe(0x22);
  });

  it('carries out past 99', () => {
    const solution = solveBcd({ kind: 'bcd', operation: 'add', a: 0x99, b: 0x01, extra: 0 });
    expect(solution.result).toBe(0x00);
    expect(solution.out).toBe(1);
    expect(solution.decimal).toMatchObject({ exact: 100, shown: 0 });
  });

  it('takes 6 off a digit below 0 and borrows from the next', () => {
    const solution = solveBcd({ kind: 'bcd', operation: 'subtract', a: 0x42, b: 0x05, extra: 0 });
    const [ones, tens] = solution.digits;
    expect(ones).toMatchObject({ raw: -3, corrected: true, digit: 7, out: 1 });
    expect(tens).toMatchObject({ extra: 1, raw: 3, corrected: false });
    expect(solution.result).toBe(0x37);
    expect(solution.out).toBe(0);
  });

  it('borrows out below 0', () => {
    const solution = solveBcd({ kind: 'bcd', operation: 'subtract', a: 0x00, b: 0x01, extra: 0 });
    expect(solution.result).toBe(0x99);
    expect(solution.out).toBe(1);
    expect(solution.decimal).toMatchObject({ exact: -1, shown: 99 });
  });

  it('counts the carry or borrow coming in', () => {
    expect(solveBcd({ kind: 'bcd', operation: 'add', a: 0x09, b: 0x00, extra: 1 }).result).toBe(
      0x10
    );
    expect(
      solveBcd({ kind: 'bcd', operation: 'subtract', a: 0x10, b: 0x00, extra: 1 }).result
    ).toBe(0x09);
  });

  it('has no decimal reading when an operand is not a decimal number', () => {
    expect(
      solveBcd({ kind: 'bcd', operation: 'add', a: 0x1a, b: 0x01, extra: 0 }).decimal
    ).toBeNull();
  });
});
