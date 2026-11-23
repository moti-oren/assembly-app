import { describe, expect, it } from 'vitest';
import { dLatch, flipFlop, srLatch } from '@/core/logic/flipFlop';
import type { Circuit } from '@/core/logic/gates';
import { register } from '@/core/logic/register';
import { cellDiagram } from './storageDiagram';
import { CELLS, type CellId } from './storageView';

const BIT = 5;

const CIRCUITS: Record<CellId, Circuit> = {
  sr: srLatch(),
  d: dLatch(),
  flipFlop: flipFlop(),
  register: register(8)
};

describe.each(CELLS.map((cell) => cell.id))('cellDiagram: %s', (cell) => {
  const circuit = CIRCUITS[cell];
  const diagram = cellDiagram(cell, BIT);
  const known = new Set([...circuit.inputs, ...circuit.gates.map((gate) => gate.id)]);

  it('draws only wires the circuit has', () => {
    const drawn = [
      ...diagram.wires.map((wire) => wire.signal),
      ...diagram.dots.map((dot) => dot.signal),
      ...diagram.terminals.map((terminal) => terminal.signal),
      ...diagram.gates.flatMap((gate) => [gate.id, ...gate.inputs])
    ];
    expect(drawn.filter((signal) => !known.has(signal))).toEqual([]);
  });

  it('draws each gate as the circuit has it', () => {
    for (const drawn of diagram.gates) {
      const gate = circuit.gates.find((each) => each.id === drawn.id)!;
      expect(drawn.kind).toBe(gate.kind);
      // A mux reads its inputs in order; the others read them in any.
      if (gate.kind === 'mux') expect(drawn.inputs).toEqual(gate.inputs);
      else expect([...drawn.inputs].sort()).toEqual([...gate.inputs].sort());
      expect(drawn.inputNames).toHaveLength(drawn.inputs.length);
    }
  });

  it('leaves no gate of the cell out', () => {
    const own =
      cell === 'register'
        ? circuit.gates.filter((gate) => gate.id.endsWith(String(BIT)) || gate.id === 'nclk')
        : circuit.gates;
    expect(diagram.gates.map((gate) => gate.id).sort()).toEqual(own.map((gate) => gate.id).sort());
  });

  it('keeps everything inside the drawing', () => {
    const points = [
      ...diagram.wires.flatMap((wire) => wire.points),
      ...diagram.gates.map((gate) => [gate.x + 44, gate.y + 40] as const)
    ];
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(diagram.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(diagram.height);
    }
  });
});
