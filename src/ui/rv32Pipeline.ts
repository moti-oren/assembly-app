import { formatLabel } from '@/core/shared/program';
import { formatRegister } from '@/core/rv32/operands';
import type { PipelineRow, PipelineStage, PipelineTiming } from '@/core/rv32/pipeline';
import type { Messages } from './messages/en';

/** A cycle in a stage: doing its work, waiting there, or on an instruction that was flushed. */
export interface PipelineCell {
  stage: PipelineStage;
  kind: 'run' | 'stall' | 'flushed';
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
}

function labelOf(row: PipelineRow): string {
  return row.line === null ? '' : formatLabel(row.line);
}

/** The last `size` rows, as a grid with a column per cycle. */
export function pipelineGrid(m: Messages, timing: PipelineTiming, size: number): PipelineGrid {
  const start = Math.max(0, timing.rows.length - size);
  const shown = timing.rows.slice(start);
  if (shown.length === 0) return { from: start, cycles: [], rows: [] };
  const first = Math.min(...shown.map((row) => row.cycles[0].cycle));
  const last = Math.max(...shown.map((row) => row.cycles[row.cycles.length - 1].cycle));
  const cycles = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const newest = timing.instructions - 1;
  return {
    from: start,
    cycles,
    rows: shown.map((row, index) => {
      const flushed = row.flushedBy !== null;
      const cells: (PipelineCell | null)[] = cycles.map(() => null);
      for (const { cycle, stage, stalled } of row.cycles) {
        cells[cycle - first] = { stage, kind: flushed ? 'flushed' : stalled ? 'stall' : 'run' };
      }
      return {
        key: start + index,
        label: labelOf(row),
        text: row.text || m.pipelineNotes.pastEnd,
        flushed,
        newest: row.step === newest,
        cells
      };
    })
  };
}

function named(m: Messages, row: PipelineRow): string {
  const label = labelOf(row);
  const text = m.common.code(row.text);
  return label ? `${label} (${text})` : text;
}

/** Why the rows from `from` on were held up, in words: a sentence per stall and per flush. */
export function pipelineNotes(m: Messages, timing: PipelineTiming, from: number): string[] {
  const n = m.pipelineNotes;
  const notes: string[] = [];
  timing.rows.slice(from).forEach((row) => {
    if (row.hazard) {
      const { register, producer, load, cycles } = row.hazard;
      const source = timing.rows[producer];
      const why = load ? n.load(named(m, source)) : n.noForwarding(named(m, source));
      notes.push(n.waits(named(m, row), cycles, formatRegister(register), why));
    }
    if (row.taken) {
      notes.push(n.flushes(named(m, row)));
    }
  });
  return notes;
}

/** Where the cycles went: one per instruction, four to fill the pipeline, and the rest lost. */
export function pipelineSummary(m: Messages, timing: PipelineTiming): string | null {
  const n = m.pipelineNotes;
  const { instructions, cycles, stallCycles, flushCycles } = timing;
  if (instructions === 0) return null;
  const parts = [n.instructions(instructions), n.fill];
  if (stallCycles > 0) parts.push(n.stalled(stallCycles));
  if (flushCycles > 0) parts.push(n.flushed(flushCycles));
  const cpi = (cycles / instructions).toFixed(2);
  return n.summary(cycles, parts.join(' + '), cpi);
}
