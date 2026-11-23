import { CELL } from '@/core/logic/flipFlop';
import { REGISTER } from '@/core/logic/register';
import {
  gate,
  terminal,
  wire,
  type DiagramDot,
  type DiagramGate,
  type DiagramWire,
  type SliceDiagram
} from './logicSlice';
import type { CellId } from './storageView';

/** The gates, wires and branch points of a part of a drawing. */
interface Part {
  gates: DiagramGate[];
  wires: DiagramWire[];
  dots: DiagramDot[];
}

/** Where the input wires start, leaving room on their left for a name and a value. */
const IN = 76;
/** The rows the two halves of a latch sit on: its inputs come in at these heights. */
const TOP = 42;
const BOTTOM = 128;
/** The heights its two outputs leave at. */
const Q_Y = 50;
const NOT_Q_Y = 120;

const dot = (signal: string, x: number, y: number): DiagramDot => ({ signal, x, y });

/** The names of a latch's four wires, and what each is called in a truth table. */
interface LatchWires {
  set: string;
  reset: string;
  q: string;
  notQ: string;
  /** What the bit is: `the bit`, or `the bit the first latch took in`. */
  holds: string;
}

/**
 * Two NOR gates at `x`, each feeding the other: the two wires that cross between them are the
 * loop. Reset comes in at TOP, set at BOTTOM; q leaves at Q_Y and its inverse at NOT_Q_Y, 60 to
 * the right.
 */
function latch(x: number, { set, reset, q, notQ, holds }: LatchWires): Part {
  const out = x + 60;
  const back = x - 14;
  return {
    gates: [
      gate(q, 'nor', holds, x, 30, [reset, notQ], ['R', 'Q̅']),
      gate(notQ, 'nor', `${holds}, inverted`, x, 100, [q, set], ['Q', 'S'])
    ],
    wires: [
      wire(q, [x + 44, Q_Y], [out, Q_Y]),
      wire(q, [out, Q_Y], [out, 70], [back, 92], [back, 112], [x, 112]),
      wire(notQ, [x + 44, NOT_Q_Y], [out, NOT_Q_Y]),
      wire(notQ, [out, NOT_Q_Y], [out, 100], [back, 78], [back, 58], [x, 58])
    ],
    dots: [dot(q, out, Q_Y), dot(notQ, out, NOT_Q_Y)]
  };
}

/** The two AND gates at `x` that let `data` through to a latch only while `open` is 1. */
function gates(
  x: number,
  wires: { set: string; reset: string; data: string; notData: string; open: string },
  names: { data: string; open: string }
): DiagramGate[] {
  return [
    gate(
      wires.reset,
      'and',
      'reset, when let through',
      x,
      22,
      [wires.notData, wires.open],
      [`${names.data}̅`, names.open]
    ),
    gate(
      wires.set,
      'and',
      'set, when let through',
      x,
      108,
      [wires.open, wires.data],
      [names.open, names.data]
    )
  ];
}

function merge(...parts: Part[]): Part {
  return {
    gates: parts.flatMap((part) => part.gates),
    wires: parts.flatMap((part) => part.wires),
    dots: parts.flatMap((part) => part.dots)
  };
}

function srLatch(): SliceDiagram {
  const { set, reset, q, notQ } = CELL;
  const part = latch(170, { set, reset, q, notQ, holds: 'the bit' });
  return {
    width: 380,
    height: 160,
    ...part,
    wires: [
      wire(reset, [IN, TOP], [170, TOP]),
      wire(set, [IN, BOTTOM], [170, BOTTOM]),
      ...part.wires,
      wire(q, [230, Q_Y], [310, Q_Y]),
      wire(notQ, [230, NOT_Q_Y], [310, NOT_Q_Y])
    ],
    terminals: [
      terminal(reset, 'R', IN, TOP, 'in'),
      terminal(set, 'S', IN, BOTTOM, 'in'),
      terminal(q, 'Q', 310, Q_Y, 'out'),
      terminal(notQ, 'Q̅', 310, NOT_Q_Y, 'out')
    ],
    expressions: ['Q = NOT (R + Q̅)', 'Q̅ = NOT (S + Q)']
  };
}

function dLatch(): SliceDiagram {
  const { data, notData, enable, set, reset, q, notQ } = CELL;
  const part = latch(280, { set, reset, q, notQ, holds: 'the bit' });
  return {
    width: 470,
    height: 170,
    gates: [
      gate(notData, 'not', 'D, inverted', 110, 14, [data], ['D']),
      ...gates(190, { set, reset, data, notData, open: enable }, { data: 'D', open: 'E' }),
      ...part.gates
    ],
    wires: [
      wire(data, [IN, 136], [190, 136]),
      wire(data, [96, 136], [96, 34], [110, 34]),
      wire(notData, [154, 34], [190, 34]),
      wire(enable, [IN, 85], [170, 85]),
      wire(enable, [170, 50], [170, 120]),
      wire(enable, [170, 50], [190, 50]),
      wire(enable, [170, 120], [190, 120]),
      wire(reset, [234, TOP], [280, TOP]),
      wire(set, [234, BOTTOM], [280, BOTTOM]),
      ...part.wires,
      wire(q, [340, Q_Y], [400, Q_Y]),
      wire(notQ, [340, NOT_Q_Y], [400, NOT_Q_Y])
    ],
    dots: [dot(data, 96, 136), dot(enable, 170, 85), ...part.dots],
    terminals: [
      terminal(data, 'D', IN, 136, 'in'),
      terminal(enable, 'E', IN, 85, 'in'),
      terminal(q, 'Q', 400, Q_Y, 'out'),
      terminal(notQ, 'Q̅', 400, NOT_Q_Y, 'out')
    ],
    expressions: ['S = D · E', 'R = D̅ · E', 'Q = NOT (R + Q̅)']
  };
}

/** The height the clock runs along, under the gates. */
const CLOCK_Y = 205;

/**
 * A flip-flop drawn from `left`: the inverters, the first latch with its two gates, the second
 * with its two. `name` gives each wire its name in the circuit; `data` comes in at (left, 136)
 * and the clock at (left, CLOCK_Y).
 */
function flipFlopPart(left: number, name: (wire: string) => string, data: string): Part {
  const { clock, notClock } = CELL;
  const at = (x: number) => left - IN + x;
  const notData = name(CELL.notData);
  const master = {
    set: name(CELL.masterSet),
    reset: name(CELL.masterReset),
    q: name(CELL.masterQ),
    notQ: name(CELL.masterNotQ)
  };
  const slave = {
    set: name(CELL.set),
    reset: name(CELL.reset),
    q: name(CELL.q),
    notQ: name(CELL.notQ)
  };
  const first = latch(at(280), { ...master, holds: 'the bit the first latch took in' });
  const second = latch(at(500), { ...slave, holds: 'the bit' });
  const own: Part = {
    gates: [
      gate(notData, 'not', 'D, inverted', at(110), 14, [data], ['D']),
      gate(notClock, 'not', 'the clock, inverted', at(110), 65, [clock], ['clk']),
      ...gates(at(190), { ...master, data, notData, open: notClock }, { data: 'D', open: 'clk̅' }),
      // The second latch is set by the first one's bit, and reset by its inverse.
      ...gates(
        at(410),
        { ...slave, data: master.q, notData: master.notQ, open: clock },
        { data: 'M', open: 'clk' }
      )
    ],
    wires: [
      wire(data, [at(IN), 136], [at(190), 136]),
      wire(data, [at(90), 136], [at(90), 34], [at(110), 34]),
      wire(notData, [at(154), 34], [at(190), 34]),
      wire(clock, [at(IN), CLOCK_Y], [at(390), CLOCK_Y], [at(390), 50], [at(410), 50]),
      wire(clock, [at(390), 120], [at(410), 120]),
      wire(clock, [at(100), CLOCK_Y], [at(100), 85], [at(110), 85]),
      wire(notClock, [at(154), 85], [at(172), 85]),
      wire(notClock, [at(172), 50], [at(172), 120]),
      wire(notClock, [at(172), 50], [at(190), 50]),
      wire(notClock, [at(172), 120], [at(190), 120]),
      wire(master.reset, [at(234), TOP], [at(280), TOP]),
      wire(master.set, [at(234), BOTTOM], [at(280), BOTTOM]),
      // The first latch's two outputs cross on their way to the second one's gates.
      wire(
        master.q,
        [at(340), Q_Y],
        [at(356), Q_Y],
        [at(356), 66],
        [at(372), 110],
        [at(372), 136],
        [at(410), 136]
      ),
      wire(
        master.notQ,
        [at(340), NOT_Q_Y],
        [at(356), NOT_Q_Y],
        [at(356), 104],
        [at(372), 60],
        [at(372), 34],
        [at(410), 34]
      ),
      wire(slave.reset, [at(454), TOP], [at(500), TOP]),
      wire(slave.set, [at(454), BOTTOM], [at(500), BOTTOM])
    ],
    dots: [
      dot(data, at(90), 136),
      dot(clock, at(100), CLOCK_Y),
      dot(clock, at(390), 120),
      dot(notClock, at(172), 85)
    ]
  };
  return merge(own, first, second);
}

const FLIP_FLOP_NOTES = ['First latch: open while clk = 0', 'Second latch: open while clk = 1'];

function flipFlop(): SliceDiagram {
  const { data, clock, q, notQ } = CELL;
  const part = flipFlopPart(IN, (name) => name, data);
  return {
    width: 680,
    height: 230,
    ...part,
    wires: [
      ...part.wires,
      wire(q, [560, Q_Y], [620, Q_Y]),
      wire(notQ, [560, NOT_Q_Y], [620, NOT_Q_Y])
    ],
    terminals: [
      terminal(data, 'D', IN, 136, 'in'),
      terminal(clock, 'clk', IN, CLOCK_Y, 'in'),
      terminal(q, 'Q', 620, Q_Y, 'out'),
      terminal(notQ, 'Q̅', 620, NOT_Q_Y, 'out')
    ],
    expressions: [...FLIP_FLOP_NOTES, 'Q takes D as clk goes from 0 to 1']
  };
}

/** One bit of a register: the switch that picks what the flip-flop is given, then the flip-flop. */
function registerBit(bit: number): SliceDiagram {
  const name = (wireName: string) => REGISTER.wire(wireName, bit);
  const data = REGISTER.data(bit);
  const q = REGISTER.q(bit);
  const input = REGISTER.input(bit);
  const write = REGISTER.write(bit);
  // The flip-flop starts where the switch's output leaves, 110 to the right of the inputs.
  const left = IN + 110;
  const part = flipFlopPart(left, name, data);
  const out = left - IN + 560;
  return {
    width: 790,
    height: 230,
    gates: [
      gate(
        data,
        'mux',
        'what the flip-flop is given',
        110,
        116,
        [write, q, input],
        ['we', 'Q', 'in']
      ),
      ...part.gates
    ],
    wires: [
      wire(input, [IN, 144], [110, 144]),
      wire(write, [IN, 176], [132, 176], [132, 151]),
      wire(data, [154, 136], [left, 136]),
      wire(CELL.clock, [IN, CLOCK_Y], [left, CLOCK_Y]),
      ...part.wires,
      wire(q, [out, Q_Y], [out + 60, Q_Y]),
      // The bit's own output comes back round to the switch.
      wire(q, [out + 30, Q_Y], [out + 30, 8], [92, 8], [92, 128], [110, 128])
    ],
    dots: [...part.dots, dot(q, out + 30, Q_Y)],
    terminals: [
      terminal(input, `in${bit}`, IN, 144, 'in'),
      terminal(write, 'we', IN, 176, 'in'),
      terminal(CELL.clock, 'clk', IN, CLOCK_Y, 'in'),
      terminal(q, `Q${bit}`, out + 60, Q_Y, 'out')
    ],
    expressions: ['D = we ? in : Q', 'Q takes D as clk goes from 0 to 1']
  };
}

/** A memory cell drawn gate by gate; `bit` is the bit of the register a register's cell shows. */
export function cellDiagram(cell: CellId, bit: number): SliceDiagram {
  switch (cell) {
    case 'sr':
      return srLatch();
    case 'd':
      return dLatch();
    case 'flipFlop':
      return flipFlop();
    case 'register':
      return registerBit(bit);
  }
}
