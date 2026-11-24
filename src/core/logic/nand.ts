import type { Circuit, Gate } from './gates';

/** Makes the names of the wires inside one gate's NAND gates. */
type Fresh = () => string;

function nand(id: string, a: string, b: string): Gate {
  return { id, kind: 'nand', inputs: [a, b] };
}

/** A gate of two inputs as NAND gates, the last of which drives `id`. */
type Pair = (id: string, a: string, b: string, fresh: Fresh) => Gate[];

const PAIRS: Record<'and' | 'or' | 'xor', Pair> = {
  // A NAND, and a second one that inverts it.
  and: (id, a, b, fresh) => {
    const both = fresh();
    return [nand(both, a, b), nand(id, both, both)];
  },
  // De Morgan: a OR b is NOT (NOT a AND NOT b).
  or: (id, a, b, fresh) => {
    const notA = fresh();
    const notB = fresh();
    return [nand(notA, a, a), nand(notB, b, b), nand(id, notA, notB)];
  },
  // The first NAND is 0 only for 1 and 1; each input is then let through only when it is not.
  xor: (id, a, b, fresh) => {
    const both = fresh();
    const onlyA = fresh();
    const onlyB = fresh();
    return [nand(both, a, b), nand(onlyA, a, both), nand(onlyB, b, both), nand(id, onlyA, onlyB)];
  }
};

/** A switch: `whenZero` is let through by NOT select, `whenOne` by select. */
function mux(id: string, [select, whenZero, whenOne]: readonly string[], fresh: Fresh): Gate[] {
  const off = fresh();
  const zero = fresh();
  const one = fresh();
  return [
    nand(off, select, select),
    nand(zero, whenZero, off),
    nand(one, whenOne, select),
    nand(id, zero, one)
  ];
}

/**
 * The gate built from NAND gates of two inputs alone, in an order where each reads only the
 * gate's inputs and the ones before it. The last drives the gate's own signal, so whatever read
 * the gate reads it still; the wires inside are named `<id>~1`, `<id>~2`, … A gate of more than
 * two inputs is a chain: the first two, then each further input with the answer so far.
 */
export function asNand(gate: Gate): Gate[] {
  const { id, kind, inputs } = gate;
  let made = 0;
  const fresh: Fresh = () => `${id}~${++made}`;
  if (inputs.length === 0) throw new Error(`Gate ${id} reads nothing to build it from.`);
  if (kind === 'not' || kind === 'mux') {
    const needed = kind === 'not' ? 1 : 3;
    if (inputs.length !== needed) {
      throw new Error(`Gate ${id} is a ${kind} with ${inputs.length} inputs, not ${needed}.`);
    }
    return kind === 'not' ? [nand(id, inputs[0], inputs[0])] : mux(id, inputs, fresh);
  }
  if (kind === 'nand' && inputs.length === 2) return [gate];

  const inverted = kind === 'nand' || kind === 'nor';
  const pair = PAIRS[kind === 'nand' ? 'and' : kind === 'nor' ? 'or' : kind];
  const gates: Gate[] = [];
  let answer = inputs[0];
  for (let index = 1; index < inputs.length; index++) {
    const last = index === inputs.length - 1;
    const target = last && !inverted ? id : fresh();
    gates.push(...pair(target, answer, inputs[index], fresh));
    answer = target;
  }
  if (inverted) return [...gates, nand(id, answer, answer)];
  // A gate of one input passes it on: two NANDs that invert it twice.
  if (inputs.length === 1) {
    const inverse = fresh();
    return [nand(inverse, answer, answer), nand(id, inverse, inverse)];
  }
  return gates;
}

/** The whole circuit built from NAND gates alone: every wire it had still carries what it did. */
export function nandCircuit(circuit: Circuit): Circuit {
  return { inputs: circuit.inputs, gates: circuit.gates.flatMap(asNand) };
}
