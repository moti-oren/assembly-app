import { describe, expect, it } from 'vitest';
import {
  barrelStages,
  repeatedStages,
  shifter,
  SHIFTER,
  shiftSource,
  type ShifterShape
} from './shifter';

const shape = (overrides: Partial<ShifterShape>): ShifterShape => ({
  width: 8,
  direction: 'left',
  fill: 'zero',
  distances: [1],
  ...overrides
});

describe('shiftSource', () => {
  it('takes a bit from its neighbour', () => {
    expect(shiftSource(shape({}), 0, 3)).toBe(SHIFTER.value(0, 2));
    expect(shiftSource(shape({ direction: 'right' }), 0, 3)).toBe(SHIFTER.value(0, 4));
  });

  it('fills the end the bits leave according to the kind of shift', () => {
    expect(shiftSource(shape({}), 0, 0)).toBe(SHIFTER.zero);
    expect(shiftSource(shape({ direction: 'right', fill: 'sign' }), 0, 7)).toBe(
      SHIFTER.value(0, 7)
    );
    expect(shiftSource(shape({ fill: 'rotate' }), 0, 0)).toBe(SHIFTER.value(0, 7));
    expect(shiftSource(shape({ direction: 'right', fill: 'rotate' }), 0, 7)).toBe(
      SHIFTER.value(0, 0)
    );
    expect(shiftSource(shape({ fill: 'carry' }), 0, 0)).toBe(SHIFTER.carry(0));
  });
});

describe('shifter', () => {
  it('has a mux per bit and one for the carry in every stage', () => {
    expect(shifter(shape({ distances: [1, 2, 4] })).gates).toHaveLength(27);
  });
});

describe('stages', () => {
  it('switches a barrel shifter’s stages by the bits of the count', () => {
    expect(barrelStages(5, 8)).toEqual([
      { distance: 1, on: 1 },
      { distance: 2, on: 0 },
      { distance: 4, on: 1 }
    ]);
  });

  it('repeats a shift by one for a CPU that shifts a bit at a time', () => {
    expect(repeatedStages(3)).toEqual(Array(3).fill({ distance: 1, on: 1 }));
  });
});
