import { ADDER } from '@/core/logic/adder';
import type { AluSolution } from '@/core/logic/alu';
import { truthTable, type GateKind, type Signals, type TruthRow } from '@/core/logic/gates';
import { SHIFTER, shiftSource, type ShifterShape } from '@/core/logic/shifter';

type Point = readonly [x: number, y: number];

/** A gate as it is drawn: its top left corner, and the wires on its inputs in order. */
export interface DiagramGate {
  /** The signal on its output. */
  id: string;
  kind: GateKind;
  /** What the gate works out, in words. */
  name: string;
  x: number;
  y: number;
  inputs: readonly string[];
  /** What each input is called in the gate's truth table. */
  inputNames: readonly string[];
}

export interface DiagramWire {
  signal: string;
  points: readonly Point[];
}

export interface DiagramDot {
  signal: string;
  x: number;
  y: number;
}

/** Where a wire enters or leaves the drawing, with its name. */
export interface DiagramTerminal {
  signal: string;
  label: string;
  x: number;
  y: number;
  side: 'in' | 'out';
}

/** One bit of a circuit drawn gate by gate. */
export interface SliceDiagram {
  width: number;
  height: number;
  gates: DiagramGate[];
  wires: DiagramWire[];
  terminals: DiagramTerminal[];
  /** Where a wire branches. */
  dots: DiagramDot[];
  /** What the bit works out, as Boolean expressions. */
  expressions: string[];
}

export const GATE_WIDTH = 44;
export const GATE_HEIGHT = 40;

/** Where the input wires start, leaving room on their left for a name and a value. */
const IN = 76;

/** One bit of the adder: the XOR that may invert B, then the five gates of a full adder. */
function adderSlice(bit: number): SliceDiagram {
  const a = ADDER.a(bit);
  const y = ADDER.y(bit);
  const p = ADDER.propagate(bit);
  const carryIn = ADDER.carry(bit);
  const g = ADDER.generate(bit);
  const t = ADDER.passed(bit);
  const out = 548;
  return {
    width: 600,
    height: 256,
    gates: [
      gate(
        y,
        'xor',
        'B, inverted when subtracting',
        100,
        104,
        [ADDER.b(bit), ADDER.sub],
        ['B', 'sub']
      ),
      gate(p, 'xor', 'A XOR B′', 210, 30, [a, y], ['A', 'B′']),
      gate(ADDER.sum(bit), 'xor', 'the sum bit', 340, 38, [p, carryIn], ['A⊕B′', 'Cin']),
      gate(g, 'and', 'a carry made here', 210, 150, [a, y], ['A', 'B′']),
      gate(t, 'and', 'a carry passed on', 340, 180, [p, carryIn], ['A⊕B′', 'Cin']),
      gate(ADDER.carry(bit + 1), 'or', 'the carry out', 430, 158, [g, t], ['made', 'passed'])
    ],
    wires: [
      wire(a, [IN, 42], [210, 42]),
      wire(a, [186, 42], [186, 162], [210, 162]),
      wire(ADDER.b(bit), [IN, 116], [100, 116]),
      wire(ADDER.sub, [IN, 132], [100, 132]),
      wire(y, [144, 124], [170, 124], [170, 58], [210, 58]),
      wire(y, [170, 124], [170, 178], [210, 178]),
      wire(p, [254, 50], [340, 50]),
      wire(p, [290, 50], [290, 192], [340, 192]),
      wire(carryIn, [IN, 230], [310, 230], [310, 66], [340, 66]),
      wire(carryIn, [310, 208], [340, 208]),
      wire(ADDER.sum(bit), [384, 58], [out, 58]),
      wire(g, [254, 170], [430, 170]),
      wire(t, [384, 200], [406, 200], [406, 186], [430, 186]),
      wire(ADDER.carry(bit + 1), [474, 178], [out, 178])
    ],
    terminals: [
      terminal(a, `A${bit}`, IN, 42, 'in'),
      terminal(ADDER.b(bit), `B${bit}`, IN, 116, 'in'),
      terminal(ADDER.sub, 'sub', IN, 132, 'in'),
      terminal(carryIn, 'Cin', IN, 230, 'in'),
      terminal(ADDER.sum(bit), `S${bit}`, out, 58, 'out'),
      terminal(ADDER.carry(bit + 1), 'Cout', out, 178, 'out')
    ],
    dots: [
      { signal: a, x: 186, y: 42 },
      { signal: y, x: 170, y: 124 },
      { signal: p, x: 290, y: 50 },
      { signal: carryIn, x: 310, y: 208 }
    ],
    expressions: ['B′ = B ⊕ sub', 'S = A ⊕ B′ ⊕ Cin', 'Cout = A·B′ + Cin·(A ⊕ B′)']
  };
}

const LOGIC_SYMBOLS = { and: '·', or: '+', xor: '⊕' } as const;

function logicSlice(bit: number, kind: 'and' | 'or' | 'xor'): SliceDiagram {
  const a = ADDER.a(bit);
  const b = ADDER.b(bit);
  const result = ADDER.sum(bit);
  return {
    width: 320,
    height: 100,
    gates: [gate(result, kind, `bit ${bit} of the result`, 130, 30, [a, b], ['A', 'B'])],
    wires: [
      wire(a, [IN, 42], [130, 42]),
      wire(b, [IN, 58], [130, 58]),
      wire(result, [174, 50], [264, 50])
    ],
    terminals: [
      terminal(a, `A${bit}`, IN, 42, 'in'),
      terminal(b, `B${bit}`, IN, 58, 'in'),
      terminal(result, `R${bit}`, 264, 50, 'out')
    ],
    dots: [],
    expressions: [`R = A ${LOGIC_SYMBOLS[kind]} B`]
  };
}

/** The switch that sets one bit in one row of a shifter. */
function muxSlice(shape: ShifterShape, stage: number, bit: number): SliceDiagram {
  const kept = SHIFTER.value(stage, bit);
  const moved = shiftSource(shape, stage, bit);
  const on = SHIFTER.on(stage);
  const result = SHIFTER.value(stage + 1, bit);
  const movedLabel =
    moved === SHIFTER.zero
      ? '0'
      : moved === SHIFTER.carry(stage)
        ? 'carry'
        : `bit ${moved.slice(moved.indexOf('_') + 1)}`;
  return {
    width: 340,
    height: 130,
    gates: [
      gate(
        result,
        'mux',
        `bit ${bit} after this row`,
        150,
        30,
        [on, kept, moved],
        ['on', 'stay', 'move']
      )
    ],
    wires: [
      wire(kept, [IN, 42], [150, 42]),
      wire(moved, [IN, 58], [150, 58]),
      wire(on, [IN, 108], [172, 108], [172, 65]),
      wire(result, [194, 50], [284, 50])
    ],
    terminals: [
      terminal(kept, `bit ${bit}`, IN, 42, 'in'),
      terminal(moved, movedLabel, IN, 58, 'in'),
      terminal(on, 'on', IN, 108, 'in'),
      terminal(result, 'out', 284, 50, 'out')
    ],
    dots: [],
    expressions: ['out = on·move + on′·stay']
  };
}

/** A gate of a drawing, at its top left corner. */
export function gate(
  id: string,
  kind: GateKind,
  name: string,
  x: number,
  y: number,
  inputs: string[],
  inputNames: string[]
): DiagramGate {
  return { id, kind, name, x, y, inputs, inputNames };
}

export function wire(signal: string, ...points: Point[]): DiagramWire {
  return { signal, points };
}

export function terminal(
  signal: string,
  label: string,
  x: number,
  y: number,
  side: 'in' | 'out'
): DiagramTerminal {
  return { signal, label, x, y, side };
}

/** One bit of the solved circuit, gate by gate; `stage` picks the row of a shifter. */
export function sliceDiagram(
  solution: AluSolution,
  bit: number,
  stage: number
): SliceDiagram | null {
  const { request } = solution;
  switch (request.kind) {
    case 'add':
    case 'subtract':
      return adderSlice(bit);
    case 'shift':
      if (request.stages.length === 0) return null;
      return muxSlice(
        {
          width: request.width,
          direction: request.direction,
          fill: request.fill,
          distances: request.stages.map((each) => each.distance)
        },
        stage,
        bit
      );
    default:
      return logicSlice(bit, request.kind);
  }
}

/** A gate's truth table, and the row its inputs put it on now. */
export function gateTable(
  gate: DiagramGate,
  signals: Signals
): { rows: TruthRow[]; active: number } {
  const rows = truthTable(gate.kind, gate.inputs.length);
  const now = gate.inputs.map((name) => signals[name]);
  const active = rows.findIndex((row) => row.inputs.every((input, at) => input === now[at]));
  return { rows, active };
}

/** What the drawing shows: `Bit 3`, or `Bit 3, row 2` in a shifter. */
export function sliceHeading(solution: AluSolution, bit: number, stage: number): string {
  return solution.request.kind === 'shift' ? `Bit ${bit}, row ${stage + 1}` : `Bit ${bit}`;
}

/** A wire's corners as the `points` of an SVG polyline. */
export function polyline(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}
