import { describe, expect, it } from 'vitest';
import { bitOf, evaluate, gateOutput, numberFrom, truthTable, type Circuit } from './gates';

describe('gateOutput', () => {
  it('follows each gate’s truth table', () => {
    expect(truthTable('and', 2).map((row) => row.output)).toEqual([0, 0, 0, 1]);
    expect(truthTable('or', 2).map((row) => row.output)).toEqual([0, 1, 1, 1]);
    expect(truthTable('nor', 2).map((row) => row.output)).toEqual([1, 0, 0, 0]);
    expect(truthTable('xor', 2).map((row) => row.output)).toEqual([0, 1, 1, 0]);
    expect(truthTable('not', 1).map((row) => row.output)).toEqual([1, 0]);
  });

  it('takes gates with more than two inputs', () => {
    expect(gateOutput('and', [1, 1, 1])).toBe(1);
    expect(gateOutput('or', [0, 0, 0])).toBe(0);
    expect(gateOutput('xor', [1, 1, 1])).toBe(1);
  });

  it('passes one of a mux’s two inputs, picked by its select line', () => {
    expect(gateOutput('mux', [0, 1, 0])).toBe(1);
    expect(gateOutput('mux', [1, 1, 0])).toBe(0);
  });
});

describe('truthTable', () => {
  it('counts the inputs up from all zeros, the first input the highest', () => {
    expect(truthTable('and', 2).map((row) => row.inputs)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1]
    ]);
  });
});

describe('evaluate', () => {
  const circuit: Circuit = {
    inputs: ['x', 'y'],
    gates: [
      { id: 'both', kind: 'and', inputs: ['x', 'y'] },
      { id: 'neither', kind: 'not', inputs: ['both'] }
    ]
  };

  it('gives every wire its value', () => {
    expect(evaluate(circuit, { x: 1, y: 1 })).toEqual({ x: 1, y: 1, both: 1, neither: 0 });
  });

  it('refuses an input left without a value', () => {
    expect(() => evaluate(circuit, { x: 1 })).toThrow('y');
  });

  it('refuses a gate that reads a wire nothing drives yet', () => {
    const broken: Circuit = { inputs: [], gates: [{ id: 'out', kind: 'not', inputs: ['in'] }] };
    expect(() => evaluate(broken, {})).toThrow('in');
  });
});

describe('bits and numbers', () => {
  it('reads a bit of a 32-bit value', () => {
    expect(bitOf(0x80000000, 31)).toBe(1);
    expect(bitOf(0b100, 1)).toBe(0);
  });

  it('puts wires back together as an unsigned number', () => {
    const signals = { n0: 1, n1: 0, n2: 1 } as const;
    expect(numberFrom(signals, (bit) => `n${bit}`, 3)).toBe(5);
  });
});
