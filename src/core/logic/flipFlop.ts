import type { Bit, Circuit, Gate } from './gates';

/** The names of the wires of a memory cell. */
export const CELL = {
  set: 's',
  reset: 'r',
  /** The bit the cell holds, and its inverse. */
  q: 'q',
  notQ: 'nq',
  data: 'd',
  notData: 'nd',
  enable: 'e',
  clock: 'clk',
  notClock: 'nclk',
  /** The first latch of a flip-flop, which takes the data in while the clock is low. */
  masterSet: 'ms',
  masterReset: 'mr',
  masterQ: 'mq',
  masterNotQ: 'mnq'
};

/** How a cell's wires are named, so that many cells can sit in one circuit. */
type Naming = (wire: string) => string;

const plain: Naming = (wire) => wire;

/**
 * The outputs of a cell that holds `bit`, to start it from: a cell nobody has written yet holds
 * nothing definite, and would not come to rest.
 */
export function holdingBit(bit: Bit, name: Naming = plain): Record<string, Bit> {
  return { [name(CELL.q)]: bit, [name(CELL.notQ)]: bit ? 0 : 1 };
}

/** Two NOR gates, each reading the other's output: `set` makes q 1, `reset` makes it 0. */
function crossed(set: string, reset: string, q: string, notQ: string): Gate[] {
  return [
    { id: q, kind: 'nor', inputs: [reset, notQ] },
    { id: notQ, kind: 'nor', inputs: [set, q] }
  ];
}

/** The SR latch: it keeps its bit while both inputs are 0. */
export function srLatch(): Circuit {
  const { set, reset, q, notQ } = CELL;
  return { inputs: [set, reset], gates: crossed(set, reset, q, notQ) };
}

/** The D latch: while `enable` is 1 the bit follows `data`; at 0 it is kept. */
export function dLatch(): Circuit {
  const { data, notData, enable, set, reset, q, notQ } = CELL;
  return {
    inputs: [data, enable],
    gates: [
      { id: notData, kind: 'not', inputs: [data] },
      { id: set, kind: 'and', inputs: [data, enable] },
      { id: reset, kind: 'and', inputs: [notData, enable] },
      ...crossed(set, reset, q, notQ)
    ]
  };
}

/**
 * The gates of a flip-flop, without the inverter of its clock: two D latches in a row. The first
 * is open while the clock is low and the second while it is high, so the bit only moves to q at
 * the moment the clock rises. `data` is the wire the bit comes in on.
 */
export function flipFlopGates(name: Naming, data: string): Gate[] {
  const { clock, notClock } = CELL;
  const wire = {
    notData: name(CELL.notData),
    masterSet: name(CELL.masterSet),
    masterReset: name(CELL.masterReset),
    masterQ: name(CELL.masterQ),
    masterNotQ: name(CELL.masterNotQ),
    set: name(CELL.set),
    reset: name(CELL.reset),
    q: name(CELL.q),
    notQ: name(CELL.notQ)
  };
  return [
    { id: wire.notData, kind: 'not', inputs: [data] },
    { id: wire.masterSet, kind: 'and', inputs: [data, notClock] },
    { id: wire.masterReset, kind: 'and', inputs: [wire.notData, notClock] },
    ...crossed(wire.masterSet, wire.masterReset, wire.masterQ, wire.masterNotQ),
    { id: wire.set, kind: 'and', inputs: [wire.masterQ, clock] },
    { id: wire.reset, kind: 'and', inputs: [wire.masterNotQ, clock] },
    ...crossed(wire.set, wire.reset, wire.q, wire.notQ)
  ];
}

/** The D flip-flop: q takes the value of `data` when the clock goes from 0 to 1, and only then. */
export function flipFlop(): Circuit {
  const { data, clock, notClock } = CELL;
  return {
    inputs: [data, clock],
    gates: [{ id: notClock, kind: 'not', inputs: [clock] }, ...flipFlopGates(plain, data)]
  };
}
