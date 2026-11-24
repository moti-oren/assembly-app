import type { Bit, Circuit, Signals } from '@/core/logic/gates';
import { numberFrom } from '@/core/logic/gates';
import { REGISTER } from '@/core/logic/register';
import { counter, SEQUENCE, shiftRegister } from '@/core/logic/sequence';
import { chartOf, type RowSpec, type Sample, type TimingChart } from './storageTiming';

/** How many flip-flops the circuits have: enough to count to 15, and to fit a phone. */
export const SEQUENCE_WIDTH = 4;

/** The circuits of flip-flops that feed one another. */
export const SEQUENCES = [
  { id: 'shift', label: 'Shift register' },
  { id: 'counter', label: 'Counter' }
] as const;

export type SequenceId = (typeof SEQUENCES)[number]['id'];

export function sequenceLabel(id: SequenceId): string {
  return SEQUENCES.find((choice) => choice.id === id)?.label ?? id;
}

export const SEQUENCE_CIRCUITS: Record<SequenceId, Circuit> = {
  shift: shiftRegister(SEQUENCE_WIDTH),
  counter: counter(SEQUENCE_WIDTH)
};

/** The one input of each circuit besides its clock. */
export const SEQUENCE_INPUT: Record<SequenceId, { signal: string; label: string }> = {
  shift: { signal: SEQUENCE.serial, label: 'In' },
  counter: { signal: SEQUENCE.count, label: 'Count' }
};

export const SEQUENCE_LESSONS: Record<SequenceId, string> = {
  shift:
    'Four flip-flops in a row, each one’s input wired to the output of the one below it. A flip-flop takes its input only at the moment the clock rises, so at every tick each bit moves exactly one place up, and In comes in at bit 0. A latch would let the bit run through all four at once.',
  counter:
    'Four flip-flops whose inputs are worked out from their own outputs: a bit flips when every bit below it is 1. That is adding 1, so every tick counts. A CPU’s program counter is this, with a bigger step and a way to load an address.'
};

const bits = Array.from({ length: SEQUENCE_WIDTH }, (_, bit) => bit);

/** The wire each flip-flop takes in at the next clock edge. */
function nextWire(kind: SequenceId, bit: number): string {
  if (kind === 'counter') return REGISTER.data(bit);
  return bit === 0 ? SEQUENCE.serial : REGISTER.q(bit - 1);
}

/** A row of the circuit's wires, one per flip-flop, bit 0 first. */
export interface SequenceRow {
  label: string;
  /** What the row holds, for a screen reader. */
  name: string;
  bits: Bit[];
  tone: 'plain' | 'quiet';
}

/** The rows of bits the panel shows: what each flip-flop will take in, and what it holds. */
export function sequenceRows(kind: SequenceId, signals: Signals): SequenceRow[] {
  const row = (label: string, name: string, wire: (bit: number) => string, quiet = true) => ({
    label,
    name,
    bits: bits.map((bit) => signals[wire(bit)]),
    tone: quiet ? ('quiet' as const) : ('plain' as const)
  });
  return [
    ...(kind === 'counter' ? [row('Flips', 'Whether the bit will flip', SEQUENCE.toggle)] : []),
    row('Next', 'What the flip-flop will take in', (bit) => nextWire(kind, bit)),
    row('Holds', 'The flip-flops', REGISTER.q, false)
  ];
}

export function sequenceValue(signals: Signals): number {
  return numberFrom(signals, REGISTER.q, SEQUENCE_WIDTH);
}

const binary = (value: number): string => value.toString(2).padStart(SEQUENCE_WIDTH, '0');

/** What the flip-flops hold, in binary and as a number: `0101 = 5`. */
export function valueText(signals: Signals): string {
  const value = sequenceValue(signals);
  return `${binary(value)} = ${value}`;
}

function timingRows(kind: SequenceId): RowSpec[] {
  const { signal, label } = SEQUENCE_INPUT[kind];
  return [
    { signal, label, input: true },
    { signal: SEQUENCE.clock, label: 'Clock', input: true },
    ...bits.map((bit) => ({ signal: REGISTER.q(bit), label: `Q${bit}`, input: false })).reverse()
  ];
}

/** The circuit's trace as waves: its input, the clock, and every flip-flop, the top bit first. */
export function sequenceChart(kind: SequenceId, trace: readonly Sample[]): TimingChart {
  return chartOf(timingRows(kind), SEQUENCE.clock, trace);
}

export const SEQUENCE_HINT = 'Pulse the clock: every tick adds two steps on the right.';

function riseText(kind: SequenceId, before: Signals, after: Signals): string {
  const was = sequenceValue(before);
  const now = sequenceValue(after);
  const change = `${binary(was)} became ${binary(now)}`;
  if (kind === 'shift') {
    return `The clock rose: every bit moved one place up, and In (${after[SEQUENCE.serial]}) came in at bit 0. ${change}.`;
  }
  if (!after[SEQUENCE.count]) return `The clock rose, but Count is 0: it stays ${binary(now)}.`;
  return now === 0
    ? `The clock rose: ${change}. The count wrapped around to 0.`
    : `The clock rose: ${change}, ${was} + 1 = ${now}.`;
}

function inputText(kind: SequenceId, to: Bit): string {
  if (kind === 'shift') return `In is now ${to}: it waits at bit 0 for the clock to rise.`;
  return to
    ? 'Count is now 1: the next rise of the clock adds 1.'
    : 'Count is now 0: the clock will change nothing.';
}

/** One step of the trace in words: which input moved, and what the flip-flops did about it. */
export function tickText(kind: SequenceId, before: Sample | null, after: Sample): string {
  if (!before) return SEQUENCE_HINT;
  const clock = SEQUENCE.clock;
  if (before.signals[clock] !== after.signals[clock]) {
    return after.signals[clock]
      ? riseText(kind, before.signals, after.signals)
      : 'The clock fell: nothing moves until it rises again.';
  }
  return inputText(kind, after.signals[SEQUENCE_INPUT[kind].signal]);
}

/** Every step of the trace in words, the oldest first, for a reader who cannot see the waves. */
export function sequenceTold(kind: SequenceId, trace: readonly Sample[]): string[] {
  return trace.slice(1).map((sample, index) => tickText(kind, trace[index], sample));
}

/**
 * What the last press did: a pulse is two steps, and the rise is the one worth hearing. A pulse
 * is numbered, so two that did the same thing are still two lines, and both are read out.
 */
export function sequencePress(
  kind: SequenceId,
  trace: readonly Sample[],
  steps: number,
  ticks: number
): string {
  if (trace.length < 2) return trace.length ? SEQUENCE_HINT : '';
  const first = Math.max(trace.length - steps, 1);
  const text = tickText(kind, trace[first - 1], trace[first]);
  return steps > 1 ? `Tick ${ticks}. ${text}` : text;
}
