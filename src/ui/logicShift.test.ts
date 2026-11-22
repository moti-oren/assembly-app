import { describe, expect, it } from 'vitest';
import { solve, type ShiftRequest } from '@/core/logic/alu';
import { barrelStages, repeatedStages } from '@/core/logic/shifter';
import { rowUnits } from './logicLayout';
import { shifterView, shownStages, stageViews } from './logicShift';

const shift = (overrides: Partial<ShiftRequest>): ShiftRequest => ({
  kind: 'shift',
  width: 8,
  value: 0b1000_0001,
  direction: 'left',
  fill: 'zero',
  carryIn: 0,
  stages: repeatedStages(1),
  ...overrides
});

describe('stageViews', () => {
  it('says where each bit of a row comes from', () => {
    const [row] = stageViews(solve(shift({})));
    expect(row.sources).toEqual(['edge', 0, 1, 2, 3, 4, 5, 6]);
    expect(row.after).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    expect(row.carryAfter).toBe(1);
    expect(row.edge).toBe(0);
  });

  it('passes every bit straight down a row that is switched off', () => {
    const rows = stageViews(solve(shift({ stages: barrelStages(2, 8) })));
    expect(rows[0].sources).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rows[1].sources.slice(0, 3)).toEqual(['edge', 'edge', 0]);
  });

  it('brings the sign or the wrapped bit in from the value itself', () => {
    const arithmetic = stageViews(solve(shift({ direction: 'right', fill: 'sign' })))[0];
    expect(arithmetic.sources[7]).toBe(7);
    const rotated = stageViews(solve(shift({ fill: 'rotate' })))[0];
    expect(rotated.sources[0]).toBe(7);
  });

  it('brings the carry in at the edge of a rotate through carry', () => {
    const [row] = stageViews(solve(shift({ fill: 'carry', carryIn: 1 })));
    expect(row.sources[0]).toBe('edge');
    expect(row.edge).toBe(1);
  });

  it('has no rows for an operation that is not a shift', () => {
    expect(stageViews(solve({ kind: 'and', width: 8, a: 1, b: 1 }))).toEqual([]);
  });
});

describe('shifterView', () => {
  it('is null for an operation that is not a shift', () => {
    expect(shifterView(solve({ kind: 'add', width: 8, a: 1, b: 1, carryIn: 0 }))).toBeNull();
  });

  it('gives the input bits and says which way they move', () => {
    const view = shifterView(solve(shift({})))!;
    expect(view).toMatchObject({ width: 8, left: true, switched: false, carryIn: null });
    expect(view.input).toEqual([1, 0, 0, 0, 0, 0, 0, 1]);
    expect(view.shown).toEqual([0]);
  });

  it('brings a 0 in just past the end the bits move away from', () => {
    expect(shifterView(solve(shift({})))!.edgeX).toBe(rowUnits(8) + 1.5);
    expect(shifterView(solve(shift({ direction: 'right' })))!.edgeX).toBe(-1.5);
  });

  it('brings the carry round from its own column', () => {
    const left = shifterView(solve(shift({ fill: 'carry', carryIn: 1 })))!;
    expect(left).toMatchObject({ carryIn: 1, edgeX: -2 });
    const right = shifterView(solve(shift({ fill: 'carry', direction: 'right' })))!;
    expect(right.edgeX).toBe(rowUnits(8) + 2);
  });

  it('knows a barrel shifter by its rows of more than one place', () => {
    expect(shifterView(solve(shift({ stages: barrelStages(1, 8) })))!.switched).toBe(true);
  });
});

describe('shownStages', () => {
  it('shows every row of a short shift', () => {
    expect(shownStages(3)).toEqual([0, 1, 2]);
  });

  it('leaves out the middle of a long one, keeping the last row', () => {
    expect(shownStages(20)).toEqual([0, 1, 2, 3, null, 19]);
  });
});
