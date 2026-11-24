import { describe, expect, it } from 'vitest';
import { solve, type AluRequest } from './alu';
import { evaluate, gateOutput, truthTable, type Gate, type GateKind } from './gates';
import { asNand, nandCircuit } from './nand';
import { depth } from './propagation';
import { barrelStages } from './shifter';

/** What the gate's NAND gates put on its own wire for these inputs. */
function throughNand(kind: GateKind, values: readonly (0 | 1)[]): number {
  const names = values.map((_, index) => `in${index}`);
  const gate: Gate = { id: 'out', kind, inputs: names };
  const inputs = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  return evaluate({ inputs: names, gates: asNand(gate) }, inputs).out;
}

describe('asNand', () => {
  const shapes: [GateKind, number, number][] = [
    ['not', 1, 1],
    ['and', 2, 2],
    ['or', 2, 3],
    ['xor', 2, 4],
    ['nor', 2, 4],
    ['nand', 2, 1],
    ['mux', 3, 4]
  ];

  it.each(shapes)('builds %s from NAND gates that agree with it', (kind, inputCount, count) => {
    const gates = asNand({ id: 'out', kind, inputs: ['a', 'b', 'c'].slice(0, inputCount) });
    expect(gates).toHaveLength(count);
    expect(gates.every((gate) => gate.kind === 'nand' && gate.inputs.length === 2)).toBe(true);
    expect(gates[gates.length - 1].id).toBe('out');
    for (const row of truthTable(kind, inputCount)) {
      expect(throughNand(kind, row.inputs)).toBe(row.output);
    }
  });

  it.each(['and', 'or', 'xor', 'nor', 'nand'] as const)(
    'chains a %s gate of more than two inputs',
    (kind) => {
      for (const inputCount of [1, 3, 5]) {
        for (const row of truthTable(kind, inputCount)) {
          expect(throughNand(kind, row.inputs)).toBe(gateOutput(kind, row.inputs));
        }
      }
    }
  );

  it('names the wires inside after the gate', () => {
    const gates = asNand({ id: 's3', kind: 'xor', inputs: ['p3', 'c3'] });
    expect(gates.map((gate) => gate.id)).toEqual(['s3~1', 's3~2', 's3~3', 's3']);
  });

  it('refuses a gate that reads nothing', () => {
    expect(() => asNand({ id: 'out', kind: 'and', inputs: [] })).toThrow('reads nothing');
  });

  it('refuses a NOT or a switch with the wrong number of inputs', () => {
    expect(() => asNand({ id: 'out', kind: 'mux', inputs: ['s', 'a'] })).toThrow(
      'a mux with 2 inputs, not 3'
    );
    expect(() => asNand({ id: 'out', kind: 'not', inputs: ['a', 'b'] })).toThrow(
      'a not with 2 inputs, not 1'
    );
  });
});

describe('nandCircuit', () => {
  let seed = 2024;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);

  const requests = (a: number, b: number): AluRequest[] => [
    { kind: 'add', width: 16, a: a & 0xffff, b: b & 0xffff, carryIn: 0 },
    { kind: 'subtract', width: 8, a: a & 0xff, b: b & 0xff, carryIn: 1 },
    { kind: 'and', width: 8, a: a & 0xff, b: b & 0xff },
    { kind: 'or', width: 8, a: a & 0xff, b: b & 0xff },
    { kind: 'xor', width: 32, a, b },
    {
      kind: 'shift',
      width: 32,
      value: a,
      direction: b & 1 ? 'left' : 'right',
      fill: b & 2 ? 'sign' : 'zero',
      carryIn: 0,
      stages: barrelStages(b & 31, 32)
    }
  ];

  it('puts the same value on every wire the circuit had', () => {
    for (let round = 0; round < 25; round++) {
      for (const request of requests(next(), next())) {
        const { circuit, signals } = solve(request);
        const inputs = Object.fromEntries(circuit.inputs.map((name) => [name, signals[name]]));
        const built = evaluate(nandCircuit(circuit), inputs);
        for (const name of Object.keys(signals)) expect(built[name]).toBe(signals[name]);
      }
    }
  });

  it('holds nothing but NAND gates of two inputs, and more of them', () => {
    const { circuit } = solve({ kind: 'add', width: 8, a: 0, b: 0, carryIn: 0 });
    const built = nandCircuit(circuit);
    expect(built.gates.every((gate) => gate.kind === 'nand' && gate.inputs.length === 2)).toBe(
      true
    );
    expect(built.gates.length).toBeGreaterThan(circuit.gates.length);
    expect(depth(built)).toBeGreaterThan(depth(circuit));
  });
});
