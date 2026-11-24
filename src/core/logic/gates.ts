export type Bit = 0 | 1;

/** A mux reads its select line first, then the input it passes when select is 0, then when 1. */
export type GateKind = 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'not' | 'mux';

/** One gate. Its output is the signal named `id`. */
export interface Gate {
  id: string;
  kind: GateKind;
  inputs: readonly string[];
}

/**
 * A combinational circuit: the signals that come in from outside, and gates in an order where
 * each one reads only inputs and the gates before it.
 */
export interface Circuit {
  inputs: readonly string[];
  gates: readonly Gate[];
}

/** The value on every wire, by signal name. */
export type Signals = Readonly<Record<string, Bit>>;

const OUTPUTS: Record<GateKind, (inputs: readonly Bit[]) => Bit> = {
  and: (inputs) => (inputs.every((bit) => bit === 1) ? 1 : 0),
  or: (inputs) => (inputs.some((bit) => bit === 1) ? 1 : 0),
  nand: (inputs) => (inputs.every((bit) => bit === 1) ? 0 : 1),
  nor: (inputs) => (inputs.some((bit) => bit === 1) ? 0 : 1),
  xor: (inputs) => (inputs.reduce<number>((parity, bit) => parity ^ bit, 0) ? 1 : 0),
  not: ([input]) => (input ? 0 : 1),
  mux: ([select, whenZero, whenOne]) => (select ? whenOne : whenZero)
};

/** What a gate of `kind` puts out for these inputs. */
export function gateOutput(kind: GateKind, inputs: readonly Bit[]): Bit {
  return OUTPUTS[kind](inputs);
}

/** Runs the circuit: every input and every gate's output, by name. */
export function evaluate(circuit: Circuit, inputs: Signals): Signals {
  const signals: Record<string, Bit> = {};
  for (const name of circuit.inputs) {
    if (!(name in inputs)) throw new Error(`The circuit's input ${name} was not given a value.`);
    signals[name] = inputs[name];
  }
  for (const gate of circuit.gates) {
    const values = gate.inputs.map((name) => {
      if (!(name in signals)) throw new Error(`Gate ${gate.id} reads ${name} before it is driven.`);
      return signals[name];
    });
    signals[gate.id] = gateOutput(gate.kind, values);
  }
  return signals;
}

export interface TruthRow {
  inputs: readonly Bit[];
  output: Bit;
}

/** Every combination of `inputCount` inputs, counting up from all zeros, with the gate's output. */
export function truthTable(kind: GateKind, inputCount: number): TruthRow[] {
  return Array.from({ length: 2 ** inputCount }, (_, row) => {
    const inputs = Array.from(
      { length: inputCount },
      (_, i) => ((row >> (inputCount - 1 - i)) & 1) as Bit
    );
    return { inputs, output: gateOutput(kind, inputs) };
  });
}

/** Bit `index` of a number, bit 0 being the lowest. */
export function bitOf(value: number, index: number): Bit {
  return ((value >>> index) & 1) as Bit;
}

/** The unsigned number whose bit i is the signal `name(i)`. */
export function numberFrom(
  signals: Signals,
  name: (index: number) => string,
  width: number
): number {
  let value = 0;
  for (let i = 0; i < width; i++) {
    if (signals[name(i)]) value += 2 ** i;
  }
  return value;
}
