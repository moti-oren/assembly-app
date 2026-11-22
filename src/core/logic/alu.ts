import { ADDER, rippleAdder } from './adder';
import {
  bitOf,
  evaluate,
  numberFrom,
  type Bit,
  type Circuit,
  type Gate,
  type Signals
} from './gates';
import {
  shifter,
  SHIFTER,
  type ShiftDirection,
  type ShiftFill,
  type ShifterShape,
  type ShiftStage
} from './shifter';

export type Width = 8 | 16 | 32;

/** a + b, or a − b worked out as a + NOT b; `carryIn` is the bit fed to the lowest adder. */
export interface AdderRequest {
  kind: 'add' | 'subtract';
  width: Width;
  a: number;
  b: number;
  carryIn: Bit;
}

/** One gate per bit, between the same bit of a and of b. */
export interface LogicRequest {
  kind: 'and' | 'or' | 'xor';
  width: Width;
  a: number;
  b: number;
}

export interface ShiftRequest {
  kind: 'shift';
  width: Width;
  value: number;
  direction: ShiftDirection;
  fill: ShiftFill;
  /** The carry flag going in, which a rotate through carry brings into the value. */
  carryIn: Bit;
  stages: readonly ShiftStage[];
}

/** One operation of an ALU, with the values on its inputs. */
export type AluRequest = AdderRequest | LogicRequest | ShiftRequest;

/**
 * A wire a CPU's flag can be connected to. `carryOut` and `halfCarry` are the carries out of the
 * top bit and of bit 3; `less` is the signed comparison a subtraction makes; `carry` is the last
 * bit a shift pushed out.
 */
export type Tap =
  | 'carryOut'
  | 'halfCarry'
  | 'overflow'
  | 'zero'
  | 'negative'
  | 'parity'
  | 'less'
  | 'signChanged'
  | 'carry';

/** The names of the wires the flags are worked out on. */
export const FLAG_SIGNALS = {
  /** 1 when any bit of the result is 1. */
  any: 'any',
  zero: 'zero',
  /** 1 when the low byte of the result has an odd number of ones. */
  odd: 'odd',
  parity: 'parity',
  overflow: 'overflow',
  less: 'less',
  signChanged: 'signChanged'
};

/** An ALU operation worked out gate by gate. */
export interface AluSolution {
  request: AluRequest;
  circuit: Circuit;
  signals: Signals;
  /** The wire that carries each bit of the result. */
  resultSignal: (bit: number) => string;
  result: number;
  /** The wire behind each tap this operation has. */
  taps: Partial<Record<Tap, string>>;
}

interface Built {
  circuit: Circuit;
  inputs: Record<string, Bit>;
  resultSignal: (bit: number) => string;
  taps: Partial<Record<Tap, string>>;
}

/** Zero, sign and parity, which every operation works out from its result the same way. */
function resultFlags(width: number, resultSignal: (bit: number) => string): Built {
  const bits = Array.from({ length: width }, (_, bit) => resultSignal(bit));
  const { any, zero, odd, parity } = FLAG_SIGNALS;
  const gates: Gate[] = [
    { id: any, kind: 'or', inputs: bits },
    { id: zero, kind: 'not', inputs: [any] },
    { id: odd, kind: 'xor', inputs: bits.slice(0, 8) },
    { id: parity, kind: 'not', inputs: [odd] }
  ];
  return {
    circuit: { inputs: [], gates },
    inputs: {},
    resultSignal,
    taps: { zero, negative: resultSignal(width - 1), parity }
  };
}

function operandInputs(width: number, a: number, b: number): Record<string, Bit> {
  const inputs: Record<string, Bit> = {};
  for (let bit = 0; bit < width; bit++) {
    inputs[ADDER.a(bit)] = bitOf(a, bit);
    inputs[ADDER.b(bit)] = bitOf(b, bit);
  }
  return inputs;
}

function buildAdder({ kind, width, a, b, carryIn }: AdderRequest): Built {
  const adder = rippleAdder(width);
  const flags = resultFlags(width, ADDER.sum);
  const { overflow, less } = FLAG_SIGNALS;
  const carryOut = ADDER.carry(width);
  const gates: Gate[] = [
    // Signed overflow: the carry into the sign bit and the carry out of it disagree.
    { id: overflow, kind: 'xor', inputs: [carryOut, ADDER.carry(width - 1)] },
    { id: less, kind: 'xor', inputs: [ADDER.sum(width - 1), overflow] }
  ];
  return {
    circuit: { inputs: adder.inputs, gates: [...adder.gates, ...flags.circuit.gates, ...gates] },
    inputs: {
      ...operandInputs(width, a, b),
      [ADDER.sub]: kind === 'subtract' ? 1 : 0,
      [ADDER.carry(0)]: carryIn
    },
    resultSignal: ADDER.sum,
    taps: { ...flags.taps, carryOut, halfCarry: ADDER.carry(4), overflow, less }
  };
}

function buildLogic({ kind, width, a, b }: LogicRequest): Built {
  const bits = Array.from({ length: width }, (_, bit) => bit);
  const flags = resultFlags(width, ADDER.sum);
  const gates = bits.map((bit): Gate => ({
    id: ADDER.sum(bit),
    kind,
    inputs: [ADDER.a(bit), ADDER.b(bit)]
  }));
  return {
    circuit: {
      inputs: [...bits.map(ADDER.a), ...bits.map(ADDER.b)],
      gates: [...gates, ...flags.circuit.gates]
    },
    inputs: operandInputs(width, a, b),
    resultSignal: ADDER.sum,
    taps: flags.taps
  };
}

function buildShift(request: ShiftRequest): Built {
  const { width, value, stages } = request;
  const shape: ShifterShape = {
    width,
    direction: request.direction,
    fill: request.fill,
    distances: stages.map((stage) => stage.distance)
  };
  const circuit = shifter(shape);
  const resultSignal = (bit: number) => SHIFTER.value(stages.length, bit);
  const flags = resultFlags(width, resultSignal);
  const { signChanged } = FLAG_SIGNALS;
  const sign: Gate = {
    id: signChanged,
    kind: 'xor',
    inputs: [SHIFTER.value(0, width - 1), resultSignal(width - 1)]
  };
  const inputs: Record<string, Bit> = {
    [SHIFTER.carry(0)]: request.carryIn,
    [SHIFTER.zero]: 0
  };
  for (let bit = 0; bit < width; bit++) inputs[SHIFTER.value(0, bit)] = bitOf(value, bit);
  stages.forEach((stage, index) => (inputs[SHIFTER.on(index)] = stage.on));
  return {
    circuit: { inputs: circuit.inputs, gates: [...circuit.gates, ...flags.circuit.gates, sign] },
    inputs,
    resultSignal,
    taps: { ...flags.taps, carry: SHIFTER.carry(stages.length), signChanged }
  };
}

function build(request: AluRequest): Built {
  switch (request.kind) {
    case 'add':
    case 'subtract':
      return buildAdder(request);
    case 'and':
    case 'or':
    case 'xor':
      return buildLogic(request);
    case 'shift':
      return buildShift(request);
  }
}

/** Builds the circuit for the operation and runs the request's values through it. */
export function solve(request: AluRequest): AluSolution {
  const { circuit, inputs, resultSignal, taps } = build(request);
  const signals = evaluate(circuit, inputs);
  return {
    request,
    circuit,
    signals,
    resultSignal,
    result: numberFrom(signals, resultSignal, request.width),
    taps
  };
}

/** The value on a tap, or null when this operation has no such wire. */
export function tapValue(solution: AluSolution, tap: Tap): Bit | null {
  const signal = solution.taps[tap];
  return signal === undefined ? null : solution.signals[signal];
}
