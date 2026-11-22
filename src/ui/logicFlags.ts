import { flagValues, type AluCircuit } from '@/core/aluLink';
import { ADDER } from '@/core/logic/adder';
import type { AluSolution, Tap } from '@/core/logic/alu';
import type { Bit } from '@/core/logic/gates';

/** One flag of the operation: its value, and the wire of the circuit it comes from. */
export interface FlagRow {
  flag: string;
  value: Bit;
  /** The wire it is connected to, or null for a flag the instruction always clears. */
  tap: Tap | null;
  /** Where the wire comes from, in words. */
  source: string;
  /** The wire's value worked out, where there is something to work out. */
  working: string | null;
}

function sourceOf(wire: Tap, width: number): string {
  const top = width - 1;
  switch (wire) {
    case 'carryOut':
      return `the carry out of bit ${top}, the top adder`;
    case 'halfCarry':
      return 'the carry out of bit 3';
    case 'overflow':
      return `the carry into bit ${top} XOR the carry out of it`;
    case 'zero':
      return 'NOT (any bit of the result is 1)';
    case 'negative':
      return `bit ${top} of the result`;
    case 'parity':
      return 'NOT (the XOR of the result’s low 8 bits)';
    case 'less':
      return `bit ${top} of the result XOR the overflow`;
    case 'signChanged':
      return `bit ${top} before the shift XOR bit ${top} after it`;
    case 'carry':
      return 'the last bit pushed out of the end';
  }
}

function workingOf(wire: Tap, solution: AluSolution): string | null {
  const { signals } = solution;
  const { width } = solution.request;
  if (wire === 'overflow') {
    return `${signals[ADDER.carry(width - 1)]} ⊕ ${signals[ADDER.carry(width)]}`;
  }
  if (wire === 'less') {
    return `${signals[ADDER.sum(width - 1)]} ⊕ ${signals[solution.taps.overflow!]}`;
  }
  return null;
}

/** The wire through a NOT gate; NOT of the zero wire is said without the double negative. */
function invertedSource(wire: Tap, source: string): string {
  return wire === 'zero' ? 'any bit of the result is 1' : `NOT (${source})`;
}

/** Every flag the circuit sets, in the order the CPU's link lists them. */
export function flagRows(circuit: AluCircuit, solution: AluSolution): FlagRow[] {
  const values = flagValues(circuit, solution);
  const { width } = solution.request;
  const connected = circuit.taps.map(({ flag, tap: wire, inverted }): FlagRow => {
    const source = sourceOf(wire, width);
    return {
      flag,
      value: values[flag],
      tap: wire,
      source: inverted ? invertedSource(wire, source) : source,
      working: workingOf(wire, solution)
    };
  });
  const cleared = circuit.cleared.map((flag): FlagRow => ({
    flag,
    value: 0,
    tap: null,
    source: 'tied to 0: this operation always clears it',
    working: null
  }));
  return [...connected, ...cleared];
}
