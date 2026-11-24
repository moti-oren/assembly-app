import { describe, expect, it } from 'vitest';
import { solve, type AluRequest } from '@/core/logic/alu';
import { gateOutput, type Bit } from '@/core/logic/gates';
import { repeatedStages } from '@/core/logic/shifter';
import { nandCost, nandCostText, nandDiagram, nandLabel, nandSignals } from './logicNand';
import { sliceDiagram, type DiagramGate, type SliceDiagram } from './logicSlice';

const adder = solve({ kind: 'add', width: 8, a: 0x56, b: 0x33, carryIn: 0 });
const shift: AluRequest = {
  kind: 'shift',
  width: 8,
  value: 0b1010_0101,
  direction: 'left',
  fill: 'zero',
  carryIn: 0,
  stages: repeatedStages(1)
};

/** Every gate the topic draws: a bit of an adder, of each logic operation, and of a shifter. */
const drawnGates: DiagramGate[] = [
  ...sliceDiagram(adder, 1, 0)!.gates,
  ...(['and', 'or', 'xor'] as const).flatMap(
    (kind) => sliceDiagram(solve({ kind, width: 8, a: 1, b: 3 }), 0, 0)!.gates
  ),
  ...sliceDiagram(solve(shift), 2, 0)!.gates
];

/** The names of everything a drawing puts a value on. */
function signalsOf(diagram: SliceDiagram): string[] {
  return [
    ...diagram.wires.map((each) => each.signal),
    ...diagram.dots.map((each) => each.signal),
    ...diagram.terminals.map((each) => each.signal)
  ];
}

describe('nandDiagram', () => {
  it('draws every gate the circuits are drawn with', () => {
    for (const gate of drawnGates) expect(nandDiagram(gate)).not.toBeNull();
  });

  it('draws nothing but NAND gates, the last driving the gate’s own wire', () => {
    for (const gate of drawnGates) {
      const diagram = nandDiagram(gate)!;
      expect(diagram.gates.every((each) => each.kind === 'nand')).toBe(true);
      expect(diagram.gates[diagram.gates.length - 1].id).toBe(gate.id);
    }
  });

  it('draws only wires the NAND gates give a value', () => {
    for (const gate of drawnGates) {
      const inputs = Object.fromEntries(gate.inputs.map((name) => [name, 0 as Bit]));
      const signals = nandSignals(gate, inputs, null);
      for (const name of signalsOf(nandDiagram(gate)!)) expect(signals[name]).toBeDefined();
    }
  });

  it('has no drawing for a kind no circuit is drawn with', () => {
    const not: DiagramGate = { ...drawnGates[0], kind: 'not', inputs: ['a'], inputNames: ['A'] };
    expect(nandDiagram(not)).toBeNull();
  });
});

describe('nandSignals', () => {
  it('agrees with the gate on its own wire, for every input', () => {
    for (const gate of drawnGates) {
      for (let row = 0; row < 2 ** gate.inputs.length; row++) {
        const values = gate.inputs.map((_, index) => ((row >> index) & 1) as Bit);
        const inputs = Object.fromEntries(gate.inputs.map((name, index) => [name, values[index]]));
        expect(nandSignals(gate, inputs, null)[gate.id]).toBe(gateOutput(gate.kind, values));
      }
    }
  });

  it('holds a stuck gate’s output, with the NAND gates before it still working', () => {
    const gate = drawnGates[1];
    const inputs = Object.fromEntries(gate.inputs.map((name) => [name, 1 as Bit]));
    const working = nandSignals(gate, inputs, null);
    const stuck = nandSignals(gate, inputs, 1);
    expect(working[gate.id]).toBe(0);
    expect(stuck[gate.id]).toBe(1);
    expect(stuck[`${gate.id}~1`]).toBe(working[`${gate.id}~1`]);
  });
});

describe('nandCost', () => {
  it('counts more gates and a longer path', () => {
    const cost = nandCost(adder.circuit);
    expect(cost.gates).toBe(adder.circuit.gates.length);
    expect(cost.nandGates).toBeGreaterThan(cost.gates);
    expect(cost.nandDepth).toBeGreaterThan(cost.depth);
  });

  it('says what the gate, its bit and the circuit take', () => {
    const gates = sliceDiagram(adder, 1, 0)!.gates;
    const text = nandCostText(gates[1], gates, {
      gates: 54,
      nandGates: 180,
      depth: 18,
      nandDepth: 40
    });
    expect(text).toBe(
      'This XOR gate takes 4 NAND gates. The 6 gates of this bit take 19. The whole circuit, flags included, goes from 54 gates to 180, and its longest path from 18 gate delays to 40.'
    );
  });

  it('names the drawing after the gate', () => {
    expect(nandLabel(sliceDiagram(adder, 1, 0)!.gates[0])).toBe('The XOR gate as NAND gates');
    expect(nandLabel(sliceDiagram(solve(shift), 2, 0)!.gates[0])).toBe('The switch as NAND gates');
  });

  it('leaves the bit out when the gate is all of it', () => {
    const gates = sliceDiagram(solve(shift), 2, 0)!.gates;
    const text = nandCostText(gates[0], gates, { gates: 1, nandGates: 4, depth: 1, nandDepth: 3 });
    expect(text.startsWith('This switch takes 4 NAND gates. The whole circuit')).toBe(true);
  });
});
