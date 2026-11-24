import type { Width } from './alu';
import { settle } from './feedback';
import { CELL, flipFlopGates, holdingBit } from './flipFlop';
import { bitOf, numberFrom, type Bit, type Circuit, type Gate, type Signals } from './gates';

/** The names of a register's wires: one clock for all its bits, the rest once per bit. */
export const REGISTER = {
  clock: CELL.clock,
  /** The value waiting to be written. */
  input: (bit: number) => `in${bit}`,
  /** 1 lets the bit take the input at the next clock edge; 0 makes it keep what it holds. */
  write: (bit: number) => `we${bit}`,
  /** What reaches the flip-flop: the input, or its own output again. */
  data: (bit: number) => REGISTER.wire(CELL.data, bit),
  q: (bit: number) => REGISTER.wire(CELL.q, bit),
  /** A wire of the flip-flop of one bit, by its name in a single cell. */
  wire: (name: string, bit: number) => `${name}${bit}`
};

/**
 * One bit of a register: a flip-flop, and before it a switch that feeds it the input when the
 * bit is written and its own output otherwise, so a clock edge without a write changes nothing.
 */
function registerBit(bit: number): Gate[] {
  const data = REGISTER.data(bit);
  return [
    {
      id: data,
      kind: 'mux',
      inputs: [REGISTER.write(bit), REGISTER.q(bit), REGISTER.input(bit)]
    },
    ...flipFlopGates((wire) => REGISTER.wire(wire, bit), data)
  ];
}

/** A register: `width` bits that share a clock. */
export function register(width: number): Circuit {
  const bits = Array.from({ length: width }, (_, bit) => bit);
  return {
    inputs: [REGISTER.clock, ...bits.map(REGISTER.input), ...bits.map(REGISTER.write)],
    gates: [
      { id: CELL.notClock, kind: 'not', inputs: [REGISTER.clock] },
      ...bits.flatMap(registerBit)
    ]
  };
}

/** One clock cycle of a register: what it holds, what waits at its input, and which bits load. */
export interface RegisterRequest {
  width: Width;
  held: number;
  input: number;
  /** A 1 for every bit that is written; the others keep their value. */
  enabled: number;
}

/** A 1 for every bit of a register `width` bits wide. */
export function allBits(width: Width): number {
  return width === 32 ? 0xffffffff : 2 ** width - 1;
}

/** The moments of a clock cycle: the clock low, then high, then low again. */
export const CLOCK_PHASES = ['before', 'high', 'after'] as const;
export type ClockPhase = (typeof CLOCK_PHASES)[number];

/** A register taken through one clock cycle, gate by gate. */
export interface RegisterSolution {
  request: RegisterRequest;
  circuit: Circuit;
  /** Every wire at each moment of the cycle. */
  signals: Record<ClockPhase, Signals>;
  /** What the register holds once the cycle is over. */
  stored: number;
}

/** The wires of a register that holds `held`, before anything has reached its gates. */
function holding(width: number, held: number): Record<string, Bit> {
  const signals: Record<string, Bit> = {};
  for (let bit = 0; bit < width; bit++) {
    Object.assign(
      signals,
      holdingBit(bitOf(held, bit), (wire) => REGISTER.wire(wire, bit))
    );
  }
  return signals;
}

function rest(circuit: Circuit, inputs: Signals, held: Signals): Signals {
  const { signals, settled } = settle(circuit, inputs, held);
  if (!settled) throw new Error('The register did not come to rest.');
  return signals;
}

/** Builds the register and takes it through one clock cycle with the request's values. */
export function solveRegister(request: RegisterRequest): RegisterSolution {
  const { width, held, input, enabled } = request;
  const circuit = register(width);
  const inputs: Record<string, Bit> = {};
  for (let bit = 0; bit < width; bit++) {
    inputs[REGISTER.input(bit)] = bitOf(input, bit);
    inputs[REGISTER.write(bit)] = bitOf(enabled, bit);
  }
  const before = rest(circuit, { ...inputs, [REGISTER.clock]: 0 }, holding(width, held));
  const high = rest(circuit, { ...inputs, [REGISTER.clock]: 1 }, before);
  const after = rest(circuit, { ...inputs, [REGISTER.clock]: 0 }, high);
  return {
    request,
    circuit,
    signals: { before, high, after },
    stored: numberFrom(after, REGISTER.q, width)
  };
}

/** What the register holds at a moment of the cycle. */
export function heldAt(solution: RegisterSolution, phase: ClockPhase): number {
  return numberFrom(solution.signals[phase], REGISTER.q, solution.request.width);
}
