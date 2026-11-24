import type { Bit, Circuit, Gate } from './gates';

/** The broken gates of a circuit: the signal each drives, and the value its output is stuck at. */
export type Faults = Readonly<Record<string, Bit>>;

/**
 * The circuit with every gate named in `faults` broken: its output stays at one value, whatever
 * is on its inputs. Every other gate still reads it, so the fault spreads as far as they let it.
 */
export function withStuck(circuit: Circuit, faults: Faults): Circuit {
  const names = Object.keys(faults);
  if (names.length === 0) return circuit;
  const driven = new Set(circuit.gates.map((gate) => gate.id));
  for (const name of names) {
    if (!driven.has(name)) throw new Error(`No gate of the circuit drives ${name}.`);
  }
  return {
    inputs: circuit.inputs,
    gates: circuit.gates.map((gate) => {
      const stuck = faults[gate.id];
      return stuck === undefined ? gate : stuckGate(gate.id, stuck);
    })
  };
}

/** A gate that reads nothing never changes: an AND of no inputs is 1, an OR of none is 0. */
function stuckGate(id: string, value: Bit): Gate {
  return { id, kind: value ? 'and' : 'or', inputs: [] };
}
