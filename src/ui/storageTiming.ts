import { CELL } from '@/core/logic/flipFlop';
import type { Signals } from '@/core/logic/gates';
import type { FreeCellId } from './storageView';

/** A cell's wires after one change of its inputs, once its gates came to rest, or did not. */
export interface Sample {
  signals: Signals;
  settled: boolean;
}

/** How many changes the diagram keeps: the oldest is dropped, so it always fits a phone. */
export const TRACE_LENGTH = 16;

/** One wire a timing diagram follows. */
export interface RowSpec {
  signal: string;
  label: string;
  /** Whether the learner sets this wire; the others are what the gates make of it. */
  input: boolean;
}

const input = (signal: string, label: string): RowSpec => ({ signal, label, input: true });
const output = (signal: string, label: string): RowSpec => ({ signal, label, input: false });

/** The wires each cell's diagram follows, from the top. */
const TIMING_ROWS: Record<FreeCellId, readonly RowSpec[]> = {
  sr: [input(CELL.set, 'S'), input(CELL.reset, 'R'), output(CELL.q, 'Q'), output(CELL.notQ, 'Q̅')],
  d: [input(CELL.data, 'D'), input(CELL.enable, 'E'), output(CELL.q, 'Q')],
  flipFlop: [
    input(CELL.data, 'D'),
    input(CELL.clock, 'Clock'),
    output(CELL.masterQ, '1st Q'),
    output(CELL.q, 'Q')
  ]
};

/** The input that lets a bit in, which a press of Pulse raises and lowers. */
export const PULSE_WIRE: Partial<Record<FreeCellId, { signal: string; label: string }>> = {
  d: { signal: CELL.enable, label: 'E' },
  flipFlop: { signal: CELL.clock, label: 'the clock' }
};

/** The wire whose rise is the one moment the cell takes a bit in. */
const EDGE_WIRE: Partial<Record<FreeCellId, string>> = { flipFlop: CELL.clock };

/** The trace with one more sample, the oldest dropped once it is full. */
export function recorded(trace: readonly Sample[], sample: Sample): Sample[] {
  return [...trace, sample].slice(-TRACE_LENGTH);
}

const LABEL = 46;
const STEP = 20;
const VALUE = 18;
const ROW = 28;
const HIGH = 6;
const LOW = 22;

export interface TimingRow {
  label: string;
  /** Where the label's and the value's text sit. */
  y: number;
  /** The wave, as the path of an SVG line. */
  path: string;
  /** Both levels at once, for the steps the wire was neither 0 nor 1. */
  unknown: string;
  /** What the wire holds now: `0`, `1` or `?`. */
  value: string;
}

export interface TimingChart {
  width: number;
  height: number;
  rows: TimingRow[];
  /** Where the edge wire rose. */
  edges: number[];
  /** Where the labels end, and where the values start: right after the newest step. */
  labelX: number;
  valueX: number;
}

const stepX = (index: number): number => LABEL + index * STEP;

function waveOf(spec: RowSpec, trace: readonly Sample[], top: number): TimingRow {
  const known = (sample: Sample) => spec.input || sample.settled;
  const levelY = (sample: Sample) => top + (sample.signals[spec.signal] ? HIGH : LOW);
  const path: string[] = [];
  const unknown: string[] = [];
  trace.forEach((sample, index) => {
    const from = stepX(index);
    const to = stepX(index + 1);
    if (!known(sample)) {
      unknown.push(`M${from} ${top + HIGH}H${to}M${from} ${top + LOW}H${to}`);
      return;
    }
    const before = trace[index - 1];
    const joined = before !== undefined && known(before);
    path.push(joined ? `V${levelY(sample)}H${to}` : `M${from} ${levelY(sample)}H${to}`);
  });
  const last = trace[trace.length - 1];
  return {
    label: spec.label,
    y: top + (HIGH + LOW) / 2,
    path: path.join(''),
    unknown: unknown.join(''),
    value: last === undefined ? '' : known(last) ? String(last.signals[spec.signal]) : '?'
  };
}

function risesOf(signal: string, trace: readonly Sample[]): number[] {
  return trace.flatMap((sample, index) =>
    index > 0 && sample.signals[signal] === 1 && trace[index - 1].signals[signal] === 0
      ? [stepX(index)]
      : []
  );
}

/** The drawing of a cell's trace: a wave per wire, a step per change the learner made. */
export function timingChart(cell: FreeCellId, trace: readonly Sample[]): TimingChart {
  return chartOf(TIMING_ROWS[cell], EDGE_WIRE[cell] ?? null, trace);
}

/** The drawing of any trace: a wave for each of `specs`, and a mark where `edge` rose. */
export function chartOf(
  specs: readonly RowSpec[],
  edge: string | null,
  trace: readonly Sample[]
): TimingChart {
  return {
    width: LABEL + TRACE_LENGTH * STEP + VALUE,
    height: specs.length * ROW,
    rows: specs.map((spec, index) => waveOf(spec, trace, index * ROW)),
    edges: edge ? risesOf(edge, trace) : [],
    labelX: LABEL - 8,
    valueX: stepX(trace.length) + 6
  };
}

/** How a step is told: the input that moved, where the others stood, and what Q did. */
interface Change {
  signal: string;
  to: number;
  q: number;
  moved: boolean;
  after: Signals;
}

const SR_TEXT = (label: string, { to, q, moved, after }: Change): string => {
  if (after[CELL.set] && after[CELL.reset])
    return 'S and R are both 1: Q and Q̅ are both 0, which is no bit at all.';
  return `${label} went to ${to}: Q ${moved ? `is now ${q}` : `stays ${q}`}.`;
};

const D_TEXT = ({ signal, to, q, moved, after }: Change): string => {
  if (signal === CELL.enable)
    return to
      ? `E rose: the latch is open, and Q ${moved ? `took D. It is now ${q}` : `already was D`}.`
      : `E fell: the latch is shut, and Q keeps the ${q} that D was.`;
  return after[CELL.enable]
    ? `D changed while E is 1: Q followed it at once, to ${q}.`
    : `D changed while E is 0: Q did not move. It stays ${q}.`;
};

const FLIP_FLOP_TEXT = ({ signal, to, q, moved, after }: Change): string => {
  if (signal === CELL.clock)
    return to
      ? `The clock rose: Q took D${moved ? `, and is now ${q}` : `, which it already held`}.`
      : `The clock fell: Q keeps its ${q}, and the first latch is open to D again.`;
  return after[CELL.clock]
    ? `D changed while the clock is high: nothing let it in. Q stays ${q} until the next rise.`
    : `D changed while the clock is low: the first latch followed it, and Q did not move.`;
};

export const TIMING_HINT = 'Flip an input: every change adds a step on the right.';

/** The last step in words: which input moved, and what Q did about it. */
export function stepText(cell: FreeCellId, before: Sample | null, after: Sample): string {
  if (!before) return TIMING_HINT;
  // The page says why the latch cannot decide, in its own notice.
  if (!after.settled) return '';
  const moved = TIMING_ROWS[cell].filter(
    (row) => row.input && before.signals[row.signal] !== after.signals[row.signal]
  );
  const q = after.signals[CELL.q];
  if (moved.length !== 1) return `The inputs changed together: Q is ${q}.`;
  const change: Change = {
    signal: moved[0].signal,
    to: after.signals[moved[0].signal],
    q,
    moved: !before.settled || before.signals[CELL.q] !== q,
    after: after.signals
  };
  if (cell === 'sr') return SR_TEXT(moved[0].label, change);
  return cell === 'd' ? D_TEXT(change) : FLIP_FLOP_TEXT(change);
}

const UNDECIDED = 'The latch could not decide: Q was neither 0 nor 1.';

/** Every step of the trace in words, the oldest first, for a reader who cannot see the waves. */
export function traceTexts(cell: FreeCellId, trace: readonly Sample[]): string[] {
  return trace.slice(1).map((sample, index) => stepText(cell, trace[index], sample) || UNDECIDED);
}

/**
 * What the last press did, in words. A press may have made more than one step (a pulse is two),
 * and each is told, or the first would never be heard.
 */
export function pressText(cell: FreeCellId, trace: readonly Sample[], steps: number): string {
  if (trace.length < 2) return trace.length ? TIMING_HINT : '';
  const from = Math.max(trace.length - steps, 1);
  return trace
    .slice(from)
    .map((sample, index) => stepText(cell, trace[from + index - 1], sample))
    .filter(Boolean)
    .join(' ');
}
