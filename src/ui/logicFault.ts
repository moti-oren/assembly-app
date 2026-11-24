import { tapValue, type AluSolution, type Tap } from '@/core/logic/alu';
import type { Faults } from '@/core/logic/fault';
import { gateOutput, type Bit, type Signals } from '@/core/logic/gates';
import { sliceDiagram, type DiagramGate } from './logicSlice';
import { hexOf } from './logicView';

/** `faults` with the gate driving `signal` stuck at `value`. */
export function withFault(faults: Faults, signal: string, value: Bit): Faults {
  return { ...faults, [signal]: value };
}

/** `faults` with the gate driving `signal` working again. */
export function withoutFault(faults: Faults, signal: string): Faults {
  return Object.fromEntries(Object.entries(faults).filter(([name]) => name !== signal));
}

/** For every bit of the result, bit 0 first, whether the broken circuit gets it wrong. */
export function wrongBits(healthy: AluSolution, broken: AluSolution): boolean[] {
  const { width } = healthy.request;
  return Array.from({ length: width }, (_, bit) => {
    const wire = healthy.resultSignal(bit);
    return healthy.signals[wire] !== broken.signals[wire];
  });
}

/** Whether a wire a flag can be read from differs between the two circuits. */
function flagsDiffer(healthy: AluSolution, broken: AluSolution): boolean {
  return (Object.keys(healthy.taps) as Tap[]).some(
    (name) => tapValue(healthy, name) !== tapValue(broken, name)
  );
}

/**
 * For every bit, bit 0 first, whether one of the gates drawn for it is broken. A shifter has no
 * row of units to mark, so none of its bits is.
 */
export function brokenBits(faults: Faults, solution: AluSolution): boolean[] {
  const { request } = solution;
  if (request.kind === 'shift') return Array.from({ length: request.width }, () => false);
  return Array.from({ length: request.width }, (_, bit) => {
    const gates = sliceDiagram(solution, bit, 0)?.gates ?? [];
    return gates.some((gate) => faults[gate.id] !== undefined);
  });
}

/** What is broken, and what it does to the answer. */
export interface FaultSummary {
  broken: string;
  effect: string;
}

/** The broken circuit beside the working one, for `count` broken gates. */
export function faultSummary(
  healthy: AluSolution,
  broken: AluSolution,
  count: number
): FaultSummary {
  const { width } = healthy.request;
  const wrong = wrongBits(healthy, broken).filter(Boolean).length;
  return {
    broken: count === 1 ? 'One gate is broken.' : `${count} gates are broken.`,
    effect:
      wrong > 0
        ? `The circuit answers ${hexOf(broken.result, width)}; working, it would answer ${hexOf(healthy.result, width)}. ${wrong === 1 ? 'One bit is' : `${wrong} bits are`} wrong.`
        : flagsDiffer(healthy, broken)
          ? 'The result is still right, but a wire a flag is read from is not.'
          : 'These inputs hide it: the result and every flag come out right. Change an input to catch it.'
  };
}

/** What a gate being stuck means at this moment; empty for a gate that works. */
export function gateFaultNote(gate: DiagramGate, stuck: Bit | null, signals: Signals): string {
  if (stuck === null) return '';
  const working = gateOutput(
    gate.kind,
    gate.inputs.map((name) => signals[name])
  );
  const ignored = `Stuck at ${stuck}: the output ignores the inputs.`;
  return working === stuck
    ? `${ignored} Working, it would put out ${working} too, so these inputs hide the fault.`
    : `${ignored} Working, it would put out ${working}.`;
}
