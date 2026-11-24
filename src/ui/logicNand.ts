import { withStuck } from '@/core/logic/fault';
import { evaluate, type Bit, type Circuit, type Gate, type Signals } from '@/core/logic/gates';
import { asNand, nandCircuit } from '@/core/logic/nand';
import { depth } from '@/core/logic/propagation';
import {
  gate as drawn,
  terminal,
  wire,
  type DiagramDot,
  type DiagramGate,
  type DiagramWire,
  type SliceDiagram
} from './logicSlice';

/** Where the input wires start, leaving room on their left for a name and a value. */
const IN = 76;

/** The kinds of gate that have a drawing as NAND gates: the ones the circuits are drawn with. */
type Drawn = 'and' | 'or' | 'xor' | 'mux';

/** The gate's NAND gates, in the order `asNand` gives them. */
function partsOf(gate: DiagramGate): Gate[] {
  return asNand({ id: gate.id, kind: gate.kind, inputs: gate.inputs });
}

/** One of the gate's NAND gates, at its top left corner. */
function part(parts: readonly Gate[], index: number, x: number, y: number): DiagramGate {
  const { id, inputs } = parts[index];
  return drawn(id, 'nand', `NAND ${index + 1} of ${parts.length}`, x, y, [...inputs], []);
}

/** A wire that ends on both inputs of the NAND gate at (x, y), from where it branches. */
function fork(signal: string, fromX: number, fromY: number, x: number, y: number) {
  const wires: DiagramWire[] = [
    wire(signal, [fromX, fromY], [fromX, y + 12], [x, y + 12]),
    wire(signal, [fromX, fromY], [fromX, y + 28], [x, y + 28])
  ];
  const dot: DiagramDot = { signal, x: fromX, y: fromY };
  return { wires, dot };
}

type Layout = (gate: DiagramGate, parts: readonly Gate[]) => SliceDiagram;

const LAYOUTS: Record<Drawn, Layout> = {
  and(gate, parts) {
    const [a, b] = gate.inputs;
    const [both, out] = parts.map((each) => each.id);
    const inverted = fork(both, 205, 50, 230, 30);
    return {
      width: 400,
      height: 100,
      gates: [part(parts, 0, 130, 30), part(parts, 1, 230, 30)],
      wires: [
        wire(a, [IN, 42], [130, 42]),
        wire(b, [IN, 58], [130, 58]),
        wire(both, [174, 50], [205, 50]),
        ...inverted.wires,
        wire(out, [274, 50], [340, 50])
      ],
      terminals: [
        terminal(a, gate.inputNames[0], IN, 42, 'in'),
        terminal(b, gate.inputNames[1], IN, 58, 'in'),
        terminal(out, 'out', 340, 50, 'out')
      ],
      dots: [inverted.dot],
      expressions: ['A NAND B, then a NAND with both inputs tied together, which inverts it.']
    };
  },

  or(gate, parts) {
    const [a, b] = gate.inputs;
    const [notA, notB, out] = parts.map((each) => each.id);
    const first = fork(a, 105, 35, 130, 15);
    const second = fork(b, 105, 105, 130, 85);
    return {
      width: 410,
      height: 140,
      gates: [part(parts, 0, 130, 15), part(parts, 1, 130, 85), part(parts, 2, 240, 50)],
      wires: [
        wire(a, [IN, 35], [105, 35]),
        ...first.wires,
        wire(b, [IN, 105], [105, 105]),
        ...second.wires,
        wire(notA, [174, 35], [205, 35], [205, 62], [240, 62]),
        wire(notB, [174, 105], [205, 105], [205, 78], [240, 78]),
        wire(out, [284, 70], [350, 70])
      ],
      terminals: [
        terminal(a, gate.inputNames[0], IN, 35, 'in'),
        terminal(b, gate.inputNames[1], IN, 105, 'in'),
        terminal(out, 'out', 350, 70, 'out')
      ],
      dots: [first.dot, second.dot],
      expressions: ['Each input is inverted, and a NAND of the two is 1 unless both inputs were 0.']
    };
  },

  xor(gate, parts) {
    const [a, b] = gate.inputs;
    const [both, onlyA, onlyB, out] = parts.map((each) => each.id);
    return {
      width: 530,
      height: 160,
      gates: [
        part(parts, 0, 150, 60),
        part(parts, 1, 260, 15),
        part(parts, 2, 260, 105),
        part(parts, 3, 360, 60)
      ],
      wires: [
        wire(a, [IN, 27], [260, 27]),
        wire(a, [120, 27], [120, 72], [150, 72]),
        wire(b, [IN, 133], [260, 133]),
        wire(b, [120, 133], [120, 88], [150, 88]),
        wire(both, [194, 80], [225, 80]),
        wire(both, [225, 80], [225, 43], [260, 43]),
        wire(both, [225, 80], [225, 117], [260, 117]),
        wire(onlyA, [304, 35], [330, 35], [330, 72], [360, 72]),
        wire(onlyB, [304, 125], [330, 125], [330, 88], [360, 88]),
        wire(out, [404, 80], [470, 80])
      ],
      terminals: [
        terminal(a, gate.inputNames[0], IN, 27, 'in'),
        terminal(b, gate.inputNames[1], IN, 133, 'in'),
        terminal(out, 'out', 470, 80, 'out')
      ],
      dots: [
        { signal: a, x: 120, y: 27 },
        { signal: b, x: 120, y: 133 },
        { signal: both, x: 225, y: 80 }
      ],
      expressions: [
        'The first NAND is 0 only when both inputs are 1. Each input then passes through a NAND with it, and the last NAND is 1 when exactly one of them did.'
      ]
    };
  },

  mux(gate, parts) {
    const [select, whenZero, whenOne] = gate.inputs;
    const [off, zero, one, out] = parts.map((each) => each.id);
    return {
      width: 530,
      height: 160,
      gates: [
        part(parts, 0, 140, 60),
        part(parts, 1, 260, 15),
        part(parts, 2, 260, 105),
        part(parts, 3, 360, 60)
      ],
      wires: [
        wire(whenZero, [IN, 27], [260, 27]),
        wire(whenOne, [IN, 133], [260, 133]),
        wire(select, [IN, 80], [110, 80]),
        wire(select, [110, 80], [110, 72], [140, 72]),
        wire(select, [110, 80], [110, 117], [260, 117]),
        wire(select, [110, 88], [140, 88]),
        wire(off, [184, 80], [225, 80], [225, 43], [260, 43]),
        wire(zero, [304, 35], [330, 35], [330, 72], [360, 72]),
        wire(one, [304, 125], [330, 125], [330, 88], [360, 88]),
        wire(out, [404, 80], [470, 80])
      ],
      terminals: [
        terminal(whenZero, gate.inputNames[1], IN, 27, 'in'),
        terminal(select, gate.inputNames[0], IN, 80, 'in'),
        terminal(whenOne, gate.inputNames[2], IN, 133, 'in'),
        terminal(out, 'out', 470, 80, 'out')
      ],
      dots: [
        { signal: select, x: 110, y: 80 },
        { signal: select, x: 110, y: 88 }
      ],
      expressions: [
        'One NAND inverts the select line. Each of the two inputs then meets its own NAND, which only one of them gets through, and the last NAND puts that one out.'
      ]
    };
  }
};

function isDrawn(kind: string): kind is Drawn {
  return kind in LAYOUTS;
}

/** The gate drawn as the NAND gates it can be built from; null for a kind no circuit draws. */
export function nandDiagram(gate: DiagramGate): SliceDiagram | null {
  return isDrawn(gate.kind) ? LAYOUTS[gate.kind](gate, partsOf(gate)) : null;
}

/**
 * The value on every wire of the gate's NAND gates, run on what its inputs carry in `signals`.
 * A gate that is `stuck` has its last NAND, the one that drives its output, broken.
 */
export function nandSignals(gate: DiagramGate, signals: Signals, stuck: Bit | null): Signals {
  const names = [...new Set(gate.inputs)];
  const built: Circuit = { inputs: names, gates: partsOf(gate) };
  const inputs = Object.fromEntries(names.map((name) => [name, signals[name]]));
  return evaluate(stuck === null ? built : withStuck(built, { [gate.id]: stuck }), inputs);
}

/** What building from NAND gates alone costs: the gates, and the gate delays of the longest path. */
export interface NandCost {
  gates: number;
  nandGates: number;
  depth: number;
  nandDepth: number;
}

export function nandCost(circuit: Circuit): NandCost {
  const built = nandCircuit(circuit);
  return {
    gates: circuit.gates.length,
    nandGates: built.gates.length,
    depth: depth(circuit),
    nandDepth: depth(built)
  };
}

/** What the gate is called in a sentence: `XOR gate`, or `switch` for a mux. */
function kindName(gate: DiagramGate): string {
  return gate.kind === 'mux' ? 'switch' : `${gate.kind.toUpperCase()} gate`;
}

/** What the drawing is of, for a screen reader. */
export function nandLabel(gate: DiagramGate): string {
  return `The ${kindName(gate)} as NAND gates`;
}

/** The price in words: of the gate picked, of the bit it is drawn in, and of the whole circuit. */
export function nandCostText(
  gate: DiagramGate,
  bitGates: readonly DiagramGate[],
  cost: NandCost
): string {
  const own = partsOf(gate).length;
  const ofBit = bitGates.reduce((count, each) => count + partsOf(each).length, 0);
  const here = `This ${kindName(gate)} takes ${own} NAND gates.`;
  const bit = bitGates.length > 1 ? ` The ${bitGates.length} gates of this bit take ${ofBit}.` : '';
  return `${here}${bit} The whole circuit, flags included, goes from ${cost.gates} gates to ${cost.nandGates}, and its longest path from ${cost.depth} gate delays to ${cost.nandDepth}.`;
}
