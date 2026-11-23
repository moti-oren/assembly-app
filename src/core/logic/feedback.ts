import { gateOutput, type Bit, type Circuit, type Signals } from './gates';

/** What a circuit with a loop in it came to rest at, or where it was when it was given up on. */
export interface Settled {
  signals: Signals;
  /** False when the wires never stopped changing: the circuit cannot decide. */
  settled: boolean;
}

/**
 * Runs a circuit whose gates may read one another in a loop, which is what lets it remember.
 * Every gate takes one step to react: all of them read the wires as they were, together, again
 * and again until nothing changes. `held` is what the gates put out before the inputs changed; a
 * gate it does not name starts at 0.
 */
export function settle(circuit: Circuit, inputs: Signals, held: Signals = {}): Settled {
  let signals: Record<string, Bit> = {};
  for (const name of circuit.inputs) {
    if (!(name in inputs)) throw new Error(`The circuit's input ${name} was not given a value.`);
    signals[name] = inputs[name];
  }
  for (const gate of circuit.gates) signals[gate.id] = held[gate.id] ?? 0;

  const rounds = circuit.gates.length * 2 + 8;
  for (let round = 0; round < rounds; round++) {
    const next = react(circuit, signals);
    if (!next.changed) return { signals, settled: true };
    signals = next.signals;
  }
  return { signals, settled: false };
}

/**
 * One gate delay: every gate reads the wires as they are, all together, and puts out what it
 * makes of them. `changed` says whether any gate's output moved.
 */
export function react(
  circuit: Circuit,
  signals: Signals
): { signals: Record<string, Bit>; changed: boolean } {
  const next = { ...signals };
  let changed = false;
  for (const gate of circuit.gates) {
    const output = gateOutput(
      gate.kind,
      gate.inputs.map((name) => read(signals, name, gate.id))
    );
    if (output !== signals[gate.id]) changed = true;
    next[gate.id] = output;
  }
  return { signals: next, changed };
}

function read(signals: Signals, name: string, gate: string): Bit {
  if (!(name in signals)) throw new Error(`Gate ${gate} reads ${name}, which nothing drives.`);
  return signals[name];
}
