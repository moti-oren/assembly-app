import { describe, expect, it } from 'vitest';
import { solve, type AluRequest } from '@/core/logic/alu';
import { repeatedStages } from '@/core/logic/shifter';
import { gateTable, polyline, sliceDiagram, sliceHeading, type SliceDiagram } from './logicSlice';

/** Every wire and gate input of a drawing must be a signal the solved circuit really has. */
function expectDrawn(request: AluRequest, bit: number, stage = 0): SliceDiagram {
  const solution = solve(request);
  const diagram = sliceDiagram(solution, bit, stage)!;
  const named = [
    ...diagram.wires.map((wire) => wire.signal),
    ...diagram.dots.map((dot) => dot.signal),
    ...diagram.terminals.map((terminal) => terminal.signal),
    ...diagram.gates.flatMap((gate) => [gate.id, ...gate.inputs])
  ];
  for (const signal of named) expect(solution.signals, signal).toHaveProperty(signal);
  for (const gate of diagram.gates) expect(gate.inputNames).toHaveLength(gate.inputs.length);
  return diagram;
}

describe('sliceDiagram', () => {
  it('draws the six gates of one bit of an adder', () => {
    const diagram = expectDrawn({ kind: 'add', width: 8, a: 5, b: 3, carryIn: 0 }, 3);
    expect(diagram.gates.map((gate) => gate.kind)).toEqual([
      'xor',
      'xor',
      'xor',
      'and',
      'and',
      'or'
    ]);
    expect(diagram.terminals.map((terminal) => terminal.label)).toContain('A3');
  });

  it('draws the gates of the same bit the circuit works out', () => {
    const request: AluRequest = { kind: 'subtract', width: 8, a: 5, b: 3, carryIn: 1 };
    const diagram = expectDrawn(request, 7);
    const solution = solve(request);
    for (const gate of diagram.gates) {
      const built = solution.circuit.gates.find((each) => each.id === gate.id)!;
      expect(built.kind).toBe(gate.kind);
      expect(built.inputs).toEqual(gate.inputs);
    }
  });

  it('draws one gate for a bit of a logic operation', () => {
    const diagram = expectDrawn({ kind: 'xor', width: 16, a: 5, b: 3 }, 9);
    expect(diagram.gates).toHaveLength(1);
    expect(diagram.gates[0].kind).toBe('xor');
  });

  it('draws the switch of one bit in one row of a shifter', () => {
    const request: AluRequest = {
      kind: 'shift',
      width: 8,
      value: 0x81,
      direction: 'left',
      fill: 'zero',
      carryIn: 0,
      stages: repeatedStages(2)
    };
    const diagram = expectDrawn(request, 0, 1);
    expect(diagram.gates[0].kind).toBe('mux');
    expect(diagram.terminals.map((terminal) => terminal.label)).toEqual([
      'bit 0',
      '0',
      'on',
      'out'
    ]);
    expect(expectDrawn(request, 3, 0).terminals[1].label).toBe('bit 2');
  });

  it('has nothing to draw for a shift with no rows', () => {
    const solution = solve({
      kind: 'shift',
      width: 8,
      value: 1,
      direction: 'left',
      fill: 'zero',
      carryIn: 0,
      stages: []
    });
    expect(sliceDiagram(solution, 0, 0)).toBeNull();
  });
});

describe('gateTable', () => {
  it('finds the row of the truth table the gate is on', () => {
    const solution = solve({ kind: 'and', width: 8, a: 0b10, b: 0b11 });
    const [gate] = sliceDiagram(solution, 1, 0)!.gates;
    const table = gateTable(gate, solution.signals);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[table.active]).toEqual({ inputs: [1, 1], output: 1 });
    const [low] = sliceDiagram(solution, 0, 0)!.gates;
    expect(gateTable(low, solution.signals).active).toBe(1);
  });
});

describe('sliceHeading', () => {
  it('names the bit, and the row in a shifter', () => {
    expect(sliceHeading(solve({ kind: 'or', width: 8, a: 0, b: 0 }), 3, 0)).toBe('Bit 3');
    const shifted = solve({
      kind: 'shift',
      width: 8,
      value: 1,
      direction: 'left',
      fill: 'zero',
      carryIn: 0,
      stages: repeatedStages(2)
    });
    expect(sliceHeading(shifted, 3, 1)).toBe('Bit 3, row 2');
  });
});

describe('polyline', () => {
  it('writes the corners of a wire for SVG', () => {
    expect(
      polyline([
        [0, 1],
        [2, 3]
      ])
    ).toBe('0,1 2,3');
  });
});
