import { tapValue, type AluRequest, type AluSolution, type Tap } from './logic/alu';
import type { Bit } from './logic/gates';

/** One of a CPU's flags, and the wire of the ALU's circuit it is connected to. */
export interface FlagTap {
  /** The CPU's own name for what the wire sets: a flag, or what a comparison decides. */
  flag: string;
  tap: Tap;
  /** A NOT gate sits between the wire and the flag. */
  inverted: boolean;
}

/** The circuit behind one executed instruction: what went into the ALU, and what it set. */
export interface AluCircuit {
  request: AluRequest;
  taps: FlagTap[];
  /** Flags the instruction sets to 0 whatever the result. */
  cleared: string[];
  /** False when the result is thrown away and only the flags are kept, as in a comparison. */
  resultKept: boolean;
  note: string | null;
}

/** An instruction with no circuit to show, and why. */
export interface NoAluCircuit {
  unavailable: string;
}

/** Where an executed instruction leads in the digital logic topic. */
export type AluLink = AluCircuit | NoAluCircuit;

export function hasCircuit(link: AluLink): link is AluCircuit {
  return 'request' in link;
}

export function tap(flag: string, wire: Tap, inverted = false): FlagTap {
  return { flag, tap: wire, inverted };
}

/** The flags that every operation works out from its result alone. */
export function resultTaps(zero: string, negative: string): FlagTap[] {
  return [tap(zero, 'zero'), tap(negative, 'negative')];
}

/** The value the solved circuit gives each flag of the link. */
export function flagValues(circuit: AluCircuit, solution: AluSolution): Record<string, Bit> {
  const values: Record<string, Bit> = {};
  for (const { flag, tap: wire, inverted } of circuit.taps) {
    const value = tapValue(solution, wire);
    if (value === null) throw new Error(`The circuit has no ${wire} wire for ${flag}.`);
    values[flag] = inverted ? ((value ^ 1) as Bit) : value;
  }
  for (const flag of circuit.cleared) values[flag] = 0;
  return values;
}
