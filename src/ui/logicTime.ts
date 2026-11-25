import type { AdderRequest, AluRequest, AluSolution } from '@/core/logic/alu';
import { numberFrom, type Signals } from '@/core/logic/gates';
import { atRest, propagate, type Propagation } from '@/core/logic/propagation';

/** Whether the circuit is the adder, the one circuit shown through time. */
export function isAdder(request: AluRequest): request is AdderRequest {
  return request.kind === 'add' || request.kind === 'subtract';
}

/** Whether two requests run on the same wires, so one can start from where the other came to rest. */
export function sharesWires(one: AluRequest, other: AluRequest): boolean {
  return isAdder(one) && isAdder(other) && one.width === other.width;
}

/**
 * The solved circuit followed gate delay by gate delay, from the wires it `held` before its inputs
 * changed, or from rest (every input 0) when it held nothing.
 */
export function followThrough(solution: AluSolution, held: Signals | null): Propagation {
  const { circuit, signals } = solution;
  const inputs = Object.fromEntries(circuit.inputs.map((name) => [name, signals[name]]));
  return propagate(circuit, inputs, held ?? atRest(circuit));
}

/** The solved circuit as it looks at one moment: these wires, and the result they spell. */
export function shownSolution(solution: AluSolution, signals: Signals): AluSolution {
  return {
    ...solution,
    signals,
    result: numberFrom(signals, solution.resultSignal, solution.request.width)
  };
}

/** For every bit of a row of wires, bit 0 first, whether it will still change after `step`. */
export function pendingBits(
  propagation: Propagation,
  name: (bit: number) => string,
  width: number,
  step: number
): boolean[] {
  return Array.from({ length: width }, (_, bit) => propagation.readyAt[name(bit)] > step);
}

/** The gate delay at which every bit of a row of wires stopped changing, bit 0 first. */
export function readyRow(
  propagation: Propagation,
  name: (bit: number) => string,
  width: number
): number[] {
  return Array.from({ length: width }, (_, bit) => propagation.readyAt[name(bit)]);
}

/** A row of gate delays in one sentence, for a reader who cannot take in the row at a glance. */
export function readySummary(ready: readonly number[]): string {
  const last = Math.max(...ready);
  if (last === 0) return 'No bit of the result changed.';
  return `The result is ready at gate delay ${last}. Bit ${ready.lastIndexOf(last)} settles last.`;
}

/**
 * The values that keep an adder at rest busy the longest: a carry made at the bottom and passed
 * on by every bit above it. A subtraction gets there with 0 − 0, where every inverted bit of B
 * passes on the carry that comes in.
 */
export function longestCarry(request: AdderRequest): AdderRequest {
  if (request.kind === 'subtract') return { ...request, a: 0, b: 0, carryIn: 1 };
  return { ...request, a: 2 ** request.width - 1, b: 1, carryIn: 0 };
}

/** How far `step` is along the gate delays, as the filled part of a slider's track. */
export function progressOf(step: number, last: number): string {
  return last === 0 ? '0%' : `${(step / last) * 100}%`;
}

/** Where the circuit is in time, and what that means for its result. */
export interface TimeSummary {
  position: string;
  note: string;
}

/**
 * `step` of the `last` gate delay this change took; `worst` is what the circuit must allow for.
 */
export function timeSummary(step: number, last: number, worst: number): TimeSummary {
  if (last === 0) {
    return {
      position: 'No gate delays',
      note: 'No input changed, so no gate had to react.'
    };
  }
  const position = `Gate delay ${step} of ${last}`;
  if (step === 0) {
    return {
      position,
      note: 'The inputs have just changed. No gate has reacted: every wire inside still shows the old answer.'
    };
  }
  if (step < last) {
    return {
      position,
      note: 'Gates are still reacting. The dashed bits will change again, so the result cannot be read yet.'
    };
  }
  const took = `At rest after ${last} gate ${last === 1 ? 'delay' : 'delays'}.`;
  return {
    position,
    note:
      last === worst
        ? `${took} That is the longest this adder can take, and a clock has to wait that long every time.`
        : // `worst` is the deepest path through the gates, which no single pair of values may take.
          `${took} The deepest path through its gates is ${worst} delays, so a clock has to allow for that every time.`
  };
}
