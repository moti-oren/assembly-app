import { describe, expect, it } from 'vitest';
import { CLOCK_PHASES, heldAt, register, solveRegister, type RegisterRequest } from './register';

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

const WIDTHS = [8, 16, 32] as const;

/** What the bits of a register should hold after a clock edge. */
function expected({ width, held, input, enabled }: RegisterRequest): number {
  const all = width === 32 ? 0xffffffff : 2 ** width - 1;
  return (((held & ~enabled) | (input & enabled)) & all) >>> 0;
}

describe('register', () => {
  it('has ten gates for every bit, and one inverter for the clock', () => {
    expect(register(8).gates).toHaveLength(8 * 10 + 1);
  });
});

describe('solveRegister', () => {
  it('holds its value until the clock rises, and the new one from then on', () => {
    const solution = solveRegister({ width: 8, held: 0x3c, input: 0xa5, enabled: 0xff });
    expect(CLOCK_PHASES.map((phase) => heldAt(solution, phase))).toEqual([0x3c, 0xa5, 0xa5]);
    expect(solution.stored).toBe(0xa5);
  });

  it('keeps a bit that is not written, whatever waits at its input', () => {
    const solution = solveRegister({ width: 16, held: 0x1234, input: 0xffff, enabled: 0x00ff });
    expect(solution.stored).toBe(0x12ff);
    expect(solveRegister({ width: 16, held: 0x1234, input: 0xffff, enabled: 0 }).stored).toBe(
      0x1234
    );
  });

  it.each(WIDTHS)('agrees with the bits worked out directly, %i bits wide', (width) => {
    const next = random(width * 7919);
    const limit = 2 ** width;
    for (let i = 0; i < 40; i++) {
      const request: RegisterRequest = {
        width,
        held: next() % limit,
        input: next() % limit,
        enabled: next() % limit
      };
      expect(solveRegister(request).stored).toBe(expected(request));
    }
  });
});
