import { formatLabel } from '@/core/shared/program';
import { formatRegister } from '@/core/rv32/operands';
import type { PipelineRow, PipelineStage, PipelineTiming } from '@/core/rv32/pipeline';

/** What each stage does, for the legend. */
export const STAGE_INFO: Record<PipelineStage, string> = {
  IF: 'fetch the instruction',
  ID: 'decode it and read its registers',
  EX: 'compute in the ALU; branches decide',
  MEM: 'load or store',
  WB: 'write the result to a register'
};

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
export function pipelineGrid(timing: PipelineTiming, size: number): PipelineGrid {
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
        text: row.text || 'past the end',
        flushed,
        newest: row.step === newest,
        cells
      };
    })
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function named(row: PipelineRow): string {
  const label = labelOf(row);
  return label ? `${label} (${row.text})` : row.text;
}

/** Why the rows from `from` on were held up, in words: a sentence per stall and per flush. */
export function pipelineNotes(timing: PipelineTiming, from: number): string[] {
  const notes: string[] = [];
  timing.rows.slice(from).forEach((row) => {
    if (row.hazard) {
      const { register, producer, load, cycles } = row.hazard;
      const source = timing.rows[producer];
      const why = load
        ? `the load on ${named(source)} has it only after MEM`
        : `forwarding is off, so ${named(source)} must write it back first`;
      notes.push(
        `${named(row)} waits ${plural(cycles, 'cycle')} in ID for ${formatRegister(register)}: ${why}.`
      );
    }
    if (row.taken) {
      notes.push(
        `${named(row)} changes PC in EX: the two instructions fetched behind it are flushed.`
      );
    }
  });
  return notes;
}

/** Where the cycles went: one per instruction, four to fill the pipeline, and the rest lost. */
export function pipelineSummary(timing: PipelineTiming): string | null {
  const { instructions, cycles, stallCycles, flushCycles } = timing;
  if (instructions === 0) return null;
  const parts = [plural(instructions, 'instruction'), '4 to fill the pipeline'];
  if (stallCycles > 0) parts.push(`${stallCycles} stalled`);
  if (flushCycles > 0) parts.push(`${flushCycles} lost to flushes`);
  const cpi = (cycles / instructions).toFixed(2);
  return `${plural(cycles, 'cycle')} = ${parts.join(' + ')} · ${cpi} cycles per instruction`;
}
