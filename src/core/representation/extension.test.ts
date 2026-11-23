import { describe, expect, it } from 'vitest';
import { solveExtension } from './extension';

describe('solveExtension', () => {
  it('copies the top bit, which keeps the signed value', () => {
    const solution = solveExtension({ kind: 'extend', value: 0x80, from: 8, to: 32, signed: true });
    expect(solution).toMatchObject({
      result: 0xffffff80,
      top: 1,
      fill: 1,
      before: { unsigned: 128, signed: -128 },
      after: { unsigned: 0xffffff80, signed: -128 }
    });
  });

  it('fills with zeros, which keeps the unsigned value', () => {
    const solution = solveExtension({
      kind: 'extend',
      value: 0x80,
      from: 8,
      to: 32,
      signed: false
    });
    expect(solution).toMatchObject({
      result: 0x80,
      top: 1,
      fill: 0,
      after: { unsigned: 128, signed: 128 }
    });
  });

  it('changes nothing when the top bit is 0', () => {
    const signed = solveExtension({ kind: 'extend', value: 0x7f, from: 8, to: 16, signed: true });
    expect(signed.result).toBe(0x7f);
    expect(signed.fill).toBe(0);
  });

  it('extends 16 bits too', () => {
    const solution = solveExtension({
      kind: 'extend',
      value: 0xfffe,
      from: 16,
      to: 32,
      signed: true
    });
    expect(solution.result).toBe(0xfffffffe);
    expect(solution.after.signed).toBe(-2);
  });
});
