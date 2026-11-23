import { react } from './feedback';
import { evaluate, type Bit, type Circuit, type Signals } from './gates';

/** A circuit without a loop followed through time, from the moment its inputs changed. */
export interface Propagation {
  /**
   * Every wire after each gate delay. `steps[0]` is the moment the inputs changed, with every gate
   * still putting out what it held; the last one is the circuit at rest.
   */
  steps: readonly Signals[];
  /** The gate delay at which each wire last changed: 0 for an input, and for a gate that never moved. */
  readyAt: Readonly<Record<string, number>>;
}

/**
 * Follows a circuit without a loop as its gates react, one gate delay at a time, all together.
 * `held` is every wire as it was before the inputs changed.
 */
export function propagate(circuit: Circuit, inputs: Signals, held: Signals): Propagation {
  // A loop is refused even when it would come to rest: its delays would not be a path's length.
  const rounds = depth(circuit);
  let signals: Record<string, Bit> = {};
  for (const name of circuit.inputs) {
    if (!(name in inputs)) throw new Error(`The circuit's input ${name} was not given a value.`);
    signals[name] = inputs[name];
  }
  for (const gate of circuit.gates) {
    if (!(gate.id in held)) throw new Error(`Gate ${gate.id} was not given the value it held.`);
    signals[gate.id] = held[gate.id];
  }

  const steps: Signals[] = [signals];
  const readyAt: Record<string, number> = {};
  for (const name of Object.keys(signals)) readyAt[name] = 0;

  // A gate is final once every gate before it is: one delay for each on the longest way to it.
  for (let step = 1; step <= rounds; step++) {
    const next = react(circuit, signals);
    if (!next.changed) return { steps, readyAt };
    for (const gate of circuit.gates) {
      if (next.signals[gate.id] !== signals[gate.id]) readyAt[gate.id] = step;
    }
    signals = next.signals;
    steps.push(signals);
  }
  return { steps, readyAt };
}

/** Every wire of a circuit whose inputs are all 0 and have been for long enough. */
export function atRest(circuit: Circuit): Signals {
  const inputs: Record<string, Bit> = {};
  for (const name of circuit.inputs) inputs[name] = 0;
  return evaluate(circuit, inputs);
}

/**
 * The most gates a change passes through on its way from an input to any wire: the gate delays
 * the circuit has to be given, whatever its inputs are.
 */
export function depth(circuit: Circuit): number {
  const depths: Record<string, number> = {};
  for (const name of circuit.inputs) depths[name] = 0;
  let deepest = 0;
  for (const gate of circuit.gates) {
    const behind = gate.inputs.map((name) => {
      if (!(name in depths)) throw new Error(`Gate ${gate.id} reads ${name} before it is driven.`);
      return depths[name];
    });
    depths[gate.id] = 1 + Math.max(0, ...behind);
    deepest = Math.max(deepest, depths[gate.id]);
  }
  return deepest;
}
