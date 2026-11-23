import { describe, expect, it } from 'vitest';
import { ADDER } from '@/core/logic/adder';
import { solve, type AdderRequest, type AluRequest } from '@/core/logic/alu';
import { depth } from '@/core/logic/propagation';
import {
  followThrough,
  isAdder,
  longestCarry,
  pendingBits,
  progressOf,
  readyRow,
  readySummary,
  sharesWires,
  shownSolution,
  timeSummary
} from './logicTime';

const add: AdderRequest = { kind: 'add', width: 8, a: 0x56, b: 0x33, carryIn: 0 };
const subtract: AdderRequest = { kind: 'subtract', width: 8, a: 0x56, b: 0x33, carryIn: 1 };
const and: AluRequest = { kind: 'and', width: 8, a: 0x56, b: 0x33 };

describe('isAdder and sharesWires', () => {
  it('knows the adder, adding or subtracting', () => {
    expect(isAdder(add)).toBe(true);
    expect(isAdder(subtract)).toBe(true);
    expect(isAdder(and)).toBe(false);
  });

  it('lets an addition and a subtraction of one width share their wires', () => {
    expect(sharesWires(add, subtract)).toBe(true);
    expect(sharesWires(add, { ...add, width: 16 })).toBe(false);
    expect(sharesWires(add, and)).toBe(false);
  });
});

describe('followThrough', () => {
  it('starts an adder that held nothing from rest', () => {
    const solution = solve(add);
    const { steps } = followThrough(solution, null);
    expect(steps[0][ADDER.sum(0)]).toBe(0);
    expect(steps[0][ADDER.a(1)]).toBe(1);
    expect(steps.at(-1)).toEqual(solution.signals);
  });

  it('moves only what a flipped bit reaches', () => {
    const before = solve(add);
    const after = solve({ ...add, a: add.a ^ 0x80 });
    const { steps, readyAt } = followThrough(after, before.signals);
    expect(steps.at(-1)).toEqual(after.signals);
    expect(readyAt[ADDER.sum(0)]).toBe(0);
    expect(readyAt[ADDER.sum(7)]).toBeGreaterThan(0);
  });
});

describe('shownSolution', () => {
  it('reads the result off the wires of the moment', () => {
    const solution = solve(add);
    const { steps } = followThrough(solution, null);
    expect(shownSolution(solution, steps[0]).result).toBe(0);
    expect(shownSolution(solution, steps.at(-1)!).result).toBe(0x89);
  });
});

describe('pendingBits and readyRow', () => {
  const solution = solve(longestCarry(add));
  const propagation = followThrough(solution, null);

  it('gives the sum a later gate delay with every bit', () => {
    const ready = readyRow(propagation, ADDER.sum, 8);
    for (let bit = 2; bit < 8; bit++) expect(ready[bit] - ready[bit - 1]).toBe(2);
  });

  it('marks the bits that will still change', () => {
    const ready = readyRow(propagation, ADDER.sum, 8);
    const pending = pendingBits(propagation, ADDER.sum, 8, ready[3]);
    expect(pending).toEqual([false, false, false, false, true, true, true, true]);
  });

  it('marks nothing once the circuit is at rest', () => {
    const last = propagation.steps.length - 1;
    expect(pendingBits(propagation, ADDER.sum, 8, last)).not.toContain(true);
  });
});

describe('readySummary', () => {
  it('names the bit that settles last', () => {
    expect(readySummary([3, 4, 6, 8])).toBe(
      'The result is ready at gate delay 8. Bit 3 settles last.'
    );
  });

  it('says when nothing moved', () => {
    expect(readySummary([0, 0, 0, 0])).toBe('No bit of the result changed.');
  });
});

describe('longestCarry', () => {
  it('adds 1 to a row of ones', () => {
    expect(longestCarry({ ...add, width: 16 })).toMatchObject({ a: 0xffff, b: 1, carryIn: 0 });
    expect(longestCarry({ ...add, width: 32 }).a).toBe(0xffffffff);
  });

  it('takes a subtraction at rest as long as the circuit allows', () => {
    const solution = solve(longestCarry(subtract));
    const { steps } = followThrough(solution, null);
    const adderOnly = 2 * 8 + 2;
    expect(steps.length - 1).toBeGreaterThanOrEqual(adderOnly);
    expect(steps.length - 1).toBeLessThanOrEqual(depth(solution.circuit));
  });
});

describe('progressOf', () => {
  it('is the part of the gate delays that has passed', () => {
    expect(progressOf(5, 20)).toBe('25%');
    expect(progressOf(20, 20)).toBe('100%');
  });

  it('is nothing when there are no gate delays', () => {
    expect(progressOf(0, 0)).toBe('0%');
  });
});

describe('timeSummary', () => {
  it('says when nothing changed', () => {
    expect(timeSummary(0, 0, 20).position).toBe('No gate delays');
  });

  it('counts the gate delays', () => {
    expect(timeSummary(7, 18, 20).position).toBe('Gate delay 7 of 18');
    expect(timeSummary(7, 18, 20).note).toMatch(/cannot be read yet/);
    expect(timeSummary(0, 18, 20).note).toMatch(/old answer/);
  });

  it('compares a change at rest with the longest the adder can take', () => {
    expect(timeSummary(18, 18, 20).note).toMatch(/after 18 gate delays.*busy for 20/);
    expect(timeSummary(20, 20, 20).note).toMatch(/longest this adder can take/);
    expect(timeSummary(1, 1, 20).note).toMatch(/after 1 gate delay\./);
  });
});
