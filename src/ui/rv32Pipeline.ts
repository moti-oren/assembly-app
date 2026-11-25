import { formatLabel } from '@/core/shared/program';
import type { PredictorKind } from '@/core/rv32/branchPredictor';
import { formatRegister } from '@/core/rv32/operands';
import type {
  PipelineOptions,
  PipelineRow,
  PipelineStage,
  PipelineTiming
} from '@/core/rv32/pipeline';

/** What each stage does, for the legend. */
export const STAGE_INFO: Record<PipelineStage, string> = {
  IF: 'fetch the instruction',
  ID: 'decode it and read its registers',
  EX: 'compute in the ALU; branches decide',
  MEM: 'load or store',
  WB: 'write the result to a register'
};

/** The branch predictors, as the chart's menu and the settings name them. */
export const PREDICTOR_OPTIONS: readonly { value: PredictorKind; label: string }[] = [
  { value: 'not-taken', label: 'Not taken' },
  { value: 'taken', label: 'Taken' },
  { value: 'one-bit', label: '1 bit' },
  { value: 'two-bit', label: '2 bits' }
];

/** What each one guesses, in a sentence. */
export const PREDICTOR_INFO: Record<PredictorKind, string> = {
  'not-taken': 'Every branch is guessed not taken: the CPU keeps fetching the next lines.',
  taken: 'Every branch is guessed taken: the CPU fetches from its target.',
  'one-bit': 'A branch is guessed to do what it did the last time it ran.',
  'two-bit':
    'A branch is guessed to do what it mostly did: once the guess is sure, one wrong guess does not change it.'
};

/** A predictor's name, as the chart's menu shows the one chosen. */
export function predictorLabel(kind: PredictorKind): string {
  return PREDICTOR_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/** Only a predictor the chart knows gets through from its menu. */
export function isPredictor(value: unknown): value is PredictorKind {
  return PREDICTOR_OPTIONS.some((option) => option.value === value);
}

export const PREDICTOR_COMMANDS: Record<PredictorKind, string> = {
  'not-taken': 'Branch predictor: never taken',
  taken: 'Branch predictor: always taken',
  'one-bit': 'Branch predictor: 1 bit, what each did last',
  'two-bit': 'Branch predictor: 2 bits, what each mostly did'
};

/** A cycle in a stage: doing its work, waiting there, or on an instruction that was flushed. */
export interface PipelineCell {
  stage: PipelineStage;
  kind: 'run' | 'stall' | 'flushed';
  /** On an EX: the results it took by forwarding, each from a stage in this same cycle. */
  forwarded?: ForwardLink[];
  /** A stage whose result was handed to an EX below it in this cycle. */
  source?: true;
  /** On the EX of a conditional branch, where it decides: whether its predictor was right. */
  guess?: 'right' | 'wrong';
}

/** What a cell says when pointed at: the results it took, and how its branch was guessed. */
export function cellTitle(cell: PipelineCell | null): string | undefined {
  if (!cell) return undefined;
  const parts = (cell.forwarded ?? []).map((link) => link.text);
  if (cell.guess) parts.push(`the branch was guessed ${cell.guess}`);
  return parts.length > 0 ? parts.join('; ') : undefined;
}

/** One forwarded result, as the chart draws it: a line up the column to where it came from. */
export interface ForwardLink {
  /** Rows up from the EX to the instruction that produced it; 0 when that row is not shown. */
  rows: number;
  /** The forward in words. */
  text: string;
}

export interface PipelineGridRow {
  /** Its position among all the rows, which stays the same as more instructions run. */
  key: number;
  label: string;
  text: string;
  flushed: boolean;
  /** The instruction that ran last. */
  newest: boolean;
  /** One per cycle shown; null where the instruction is not in the pipeline. */
  cells: (PipelineCell | null)[];
}

export interface PipelineGrid {
  /** The first row shown, among all the rows. */
  from: number;
  /** The cycle numbers of the columns. */
  cycles: number[];
  rows: PipelineGridRow[];
  /** Whether any row shown took a result by forwarding. */
  forwards: boolean;
}

/** A row's line; one run from the builder came from no line, as the history says. */
function labelOf(row: PipelineRow): string {
  if (row.line !== null) return formatLabel(row.line);
  return row.step === null ? '' : 'direct';
}

/**
 * The last `size` rows, as a grid with a column per cycle. A window that would open on rows a
 * jump flushed reaches back to the jump, so they are not shown without what struck them out.
 */
export function pipelineGrid(timing: PipelineTiming, size: number): PipelineGrid {
  let start = Math.max(0, timing.rows.length - size);
  while (start > 0 && timing.rows[start].flushedBy !== null) start--;
  const shown = timing.rows.slice(start);
  if (shown.length === 0) return { from: start, cycles: [], rows: [], forwards: false };
  const first = Math.min(...shown.map((row) => row.cycles[0].cycle));
  const last = Math.max(...shown.map((row) => row.cycles[row.cycles.length - 1].cycle));
  const cycles = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const newest = timing.instructions - 1;
  const rows = shown.map((row, index) => {
    const flushed = row.flushedBy !== null;
    const cells: (PipelineCell | null)[] = cycles.map(() => null);
    for (const { cycle, stage, stalled } of row.cycles) {
      const cell: PipelineCell = { stage, kind: flushed ? 'flushed' : stalled ? 'stall' : 'run' };
      if (stage === 'EX' && row.prediction) cell.guess = row.flushes ? 'wrong' : 'right';
      cells[cycle - first] = cell;
    }
    return {
      key: start + index,
      label: labelOf(row),
      text: row.text || 'past the end',
      flushed,
      newest: row.step === newest,
      cells
    };
  });
  const forwards = markForwards(timing, shown, start, rows);
  return { from: start, cycles, rows, forwards };
}

/**
 * Marks each forwarded result on the rows shown: on the EX that took it, and on the stage of the
 * instruction above that had it in that cycle. Returns whether there was any.
 */
function markForwards(
  timing: PipelineTiming,
  shown: readonly PipelineRow[],
  start: number,
  rows: PipelineGridRow[]
): boolean {
  let any = false;
  shown.forEach((row, index) => {
    if (row.forwards.length === 0) return;
    const column = rows[index].cells.findIndex((cell) => cell?.stage === 'EX');
    const taker = rows[index].cells[column];
    if (!taker) return;
    taker.forwarded = row.forwards.map(({ register, producer, from }) => {
      const above = producer - start;
      const source = above >= 0 ? rows[above].cells[column] : null;
      if (source) source.source = true;
      return {
        rows: source ? index - above : 0,
        text: `${formatRegister(register)} forwarded from ${named(timing.rows[producer])}, in ${from}`
      };
    });
    any = true;
  });
  return any;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : word.endsWith('ch') ? 'es' : 's'}`;

function named(row: PipelineRow): string {
  const label = labelOf(row);
  return label ? `${label} (${row.text})` : row.text;
}

/** Why the rows from `from` on were held up, in words: a sentence per stall and per flush. */
export function pipelineNotes(
  timing: PipelineTiming,
  from: number,
  { forwarding }: Pick<PipelineOptions, 'forwarding'>
): string[] {
  const notes: string[] = [];
  timing.rows.slice(from).forEach((row) => {
    if (row.hazard) {
      const { register, producer, load, cycles } = row.hazard;
      const source = timing.rows[producer];
      // Without forwarding a load waits for WB like everything else, not only for MEM.
      const why =
        load && forwarding
          ? `the load on ${named(source)} has it only after MEM`
          : `forwarding is off, so ${named(source)} must write it back first`;
      notes.push(
        `${named(row)} waits ${plural(cycles, 'cycle')} in ID for ${formatRegister(register)}: ${why}.`
      );
    }
    const flush = flushNote(row);
    if (flush) notes.push(flush);
  });
  // Two rows can come to the same sentence: it is said once.
  return [...new Set(notes)];
}

const did = (taken: boolean) => (taken ? 'taken' : 'not taken');

/** What a jump or a branch cost, or what a branch guessed taken saved; nothing for the rest. */
function flushNote(row: PipelineRow): string | null {
  const { prediction, flushes } = row;
  if (!prediction) {
    if (!flushes) return null;
    return `${named(row)} changes PC in EX: the two instructions fetched behind it are flushed.`;
  }
  if (flushes) {
    return `${named(row)} was guessed ${did(prediction.guess)} and is ${did(prediction.taken)}: the two instructions fetched behind it are flushed.`;
  }
  if (!prediction.taken) return null;
  return `${named(row)} was guessed taken, and is: its target was fetched behind it, and nothing is flushed.`;
}

/** Where the cycles went: one per instruction, four to fill the pipeline, and the rest lost. */
export function pipelineSummary(timing: PipelineTiming): string | null {
  const { instructions, cycles, stallCycles, flushCycles, branches, mispredicted } = timing;
  if (instructions === 0) return null;
  const parts = [plural(instructions, 'instruction'), '4 to fill the pipeline'];
  if (stallCycles > 0) parts.push(`${stallCycles} stalled`);
  if (flushCycles > 0) parts.push(`${flushCycles} lost to flushes`);
  const cpi = (cycles / instructions).toFixed(2);
  const guessed =
    branches > 0
      ? ` · ${branches - mispredicted} of ${plural(branches, 'branch')} guessed right`
      : '';
  // A jump or a wrong guess at the very end costs nothing yet: no instruction waits behind it.
  const last = [...timing.rows].reverse().find((row) => row.flushedBy === null);
  const pending = last?.flushes ? ' · +2 more for the next instruction, if there were one' : '';
  return `${plural(cycles, 'cycle')} = ${parts.join(' + ')} · ${cpi} cycles per instruction${guessed}${pending}`;
}
