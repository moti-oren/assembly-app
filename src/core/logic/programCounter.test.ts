import { describe, expect, it } from 'vitest';
import { PC, solvePc, type PcRequest } from './programCounter';

const BASE: PcRequest = {
  width: 32,
  held: 0x40,
  step: 4,
  offset: 0x20,
  computed: 0x1000,
  fetched: 1,
  branch: 0,
  taken: 0,
  jump: 0,
  jumpComputed: 0
};

const stored = (changes: Partial<PcRequest>) => solvePc({ ...BASE, ...changes }).register.stored;

describe('solvePc', () => {
  it('moves on to the next instruction', () => {
    expect(stored({})).toBe(0x44);
  });

  it('follows a branch only when it is taken', () => {
    expect(stored({ branch: 1, taken: 1 })).toBe(0x60);
    expect(stored({ branch: 1, taken: 0 })).toBe(0x44);
  });

  it('ignores the comparison of an instruction that is not a branch', () => {
    expect(stored({ taken: 1 })).toBe(0x44);
  });

  it('always follows a jump', () => {
    expect(stored({ jump: 1 })).toBe(0x60);
  });

  it('goes back when the distance is negative', () => {
    expect(stored({ jump: 1, offset: 0xfffffff0 })).toBe(0x30);
  });

  it('takes the computed address for a jump through a register', () => {
    expect(stored({ jump: 1, jumpComputed: 1 })).toBe(0x1000);
  });

  it('wraps at the top of the address space', () => {
    expect(stored({ held: 0xfffffffc })).toBe(0);
  });

  describe('an instruction that was not fetched', () => {
    it('leaves the counter where it was', () => {
      const solution = solvePc({ ...BASE, fetched: 0 });
      expect(solution.signals[PC.load]).toBe(0);
      expect(solution.register.stored).toBe(0x40);
    });

    it('still jumps', () => {
      expect(stored({ fetched: 0, jump: 1 })).toBe(0x60);
      expect(stored({ fetched: 0, branch: 1, taken: 1 })).toBe(0x60);
      expect(stored({ fetched: 0, branch: 1, taken: 0 })).toBe(0x40);
    });
  });

  it('keeps every part it went through', () => {
    const solution = solvePc({ ...BASE, branch: 1, taken: 1 });
    expect(solution.next.result).toBe(0x44);
    expect(solution.target.result).toBe(0x60);
    expect(solution.signals[PC.redirect]).toBe(1);
    expect(solution.chosen).toBe(0x60);
  });
});
