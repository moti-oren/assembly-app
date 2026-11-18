import type { Program } from '../shared/program';
import { decode, type Decoded } from './decode';
import type { ExecutionRecord } from './execute';
import { formatInstruction, type Instruction } from './instructions';
import { addressOfLine, INSTRUCTION_SIZE, lineAt } from './state';

/**
 * How the instructions that ran would flow through the classic five-stage RISC pipeline, where
 * up to five instructions are in flight at once, each in a different stage. The CPU itself runs
 * one instruction at a time; this works out, from the history, the cycles a pipelined RISC-V
 * would have spent on the same instructions.
 *
 * The model is the textbook one: registers are written in the first half of WB and read in the
 * second half of ID; with forwarding, an ALU result reaches the next instruction's EX at once and
 * a loaded value one cycle later; branches and jumps are resolved in EX, and the CPU keeps
 * fetching the next lines until then (it predicts "not taken"), so a taken one flushes the two
 * instructions fetched behind it.
 */

export const PIPELINE_STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** One cycle an instruction spends in a stage; a stalled cycle is one it waited there. */
export interface StageCycle {
  cycle: number;
  stage: PipelineStage;
  stalled: boolean;
}

/** An operand an instruction had to wait for in ID. */
export interface DataHazard {
  register: number;
  /** The row of the instruction that produces it. */
  producer: number;
  /** A load has its value only after MEM, so even forwarding cannot avoid the wait. */
  load: boolean;
  /** Cycles it waited. */
  cycles: number;
}

/** One instruction in the pipeline: one that ran, or one fetched behind a taken branch. */
export interface PipelineRow {
  /** Its place in the history; null for an instruction that was flushed instead of run. */
  step: number | null;
  line: number | null;
  /** The instruction; empty for a fetch past the end of the program. */
  text: string;
  cycles: StageCycle[];
  hazard: DataHazard | null;
  /** A taken branch or jump: the two instructions behind it are flushed. */
  taken: boolean;
  /** For a flushed instruction, the row of the branch or jump that flushed it. */
  flushedBy: number | null;
}

export interface PipelineTiming {
  rows: PipelineRow[];
  /** Cycles until the last instruction has written back; 0 when nothing has run. */
  cycles: number;
  instructions: number;
  stallCycles: number;
  /**
   * Cycles lost refetching after taken branches and jumps: two each, except for one at the very
   * end, where nothing waits behind it.
   */
  flushCycles: number;
}

export interface PipelineOptions {
  forwarding: boolean;
}

const decoded = new WeakMap<Instruction, Decoded>();

/** Program instructions run again and again: each is decoded once. */
function decodeOnce(instruction: Instruction): Decoded {
  let known = decoded.get(instruction);
  if (!known) {
    known = decode(instruction);
    decoded.set(instruction, known);
  }
  return known;
}

/** Cycles `from` to `to` in one stage; all but the last are waits. */
function span(stage: PipelineStage, from: number, to: number): StageCycle[] {
  return Array.from({ length: to - from + 1 }, (_, index) => ({
    cycle: from + index,
    stage,
    stalled: from + index < to
  }));
}

function isTaken(record: ExecutionRecord, { nextPc }: Decoded): boolean {
  return nextPc === 'jump' || (nextPc === 'branch' && record.comparison?.taken === true);
}

/** The line at an address, if the program has one there. */
function lineOf(address: number, program: Program<Instruction>): number | null {
  const line = lineAt(address, program.length);
  return line !== null && line < program.length ? line : null;
}

/**
 * The two instructions fetched behind a taken branch or jump at `address`, while it went through
 * ID and EX: the first gets as far as ID, the second only into IF, and both are flushed.
 */
function flushedRows(
  address: number,
  program: Program<Instruction>,
  { id, ex, by }: { id: number; ex: number; by: number }
): PipelineRow[] {
  const behind = [address + INSTRUCTION_SIZE, address + 2 * INSTRUCTION_SIZE];
  const cycles: StageCycle[][] = [
    [...span('IF', id, ex - 1), { cycle: ex, stage: 'ID', stalled: false }],
    span('IF', ex, ex)
  ];
  return behind.map((next, index) => {
    const line = lineOf(next, program);
    return {
      step: null,
      line,
      text: line === null ? '' : formatInstruction(program[line]),
      cycles: cycles[index],
      hazard: null,
      taken: false,
      flushedBy: by
    };
  });
}

/** When a value written to `register` can be used by a later instruction's EX. */
function readyAt(
  { writeBack }: Decoded,
  { ex, mem, wb }: { ex: number; mem: number; wb: number },
  { forwarding }: PipelineOptions
): number {
  if (!forwarding) return wb + 1;
  return writeBack === 'memory' ? mem + 1 : ex + 1;
}

export function pipelineTiming(
  records: readonly ExecutionRecord[],
  program: Program<Instruction>,
  options: PipelineOptions
): PipelineTiming {
  const rows: PipelineRow[] = [];
  /** For each register, when its newest value can reach EX, and who produces it. */
  const ready = new Map<number, { cycle: number; producer: number; load: boolean }>();
  let fetch = 1;
  let previousEx = 0;
  let stallCycles = 0;
  let flushCycles = 0;
  /** Set by a taken branch or jump: what the next instruction loses to the flush. */
  let flushPenalty = 0;
  let last = 0;

  records.forEach((record, step) => {
    const known = decodeOnce(record.instruction);
    flushCycles += flushPenalty;
    flushPenalty = 0;
    // ID is free once the instruction ahead has moved on to EX.
    const id = Math.max(fetch + 1, previousEx);
    let ex = id + 1;
    let hazard: DataHazard | null = null;
    for (const register of known.reads) {
      const value = ready.get(register);
      if (register === 0 || !value || value.cycle <= ex) continue;
      ex = value.cycle;
      hazard = { register, producer: value.producer, load: value.load, cycles: ex - id - 1 };
    }
    const mem = ex + 1;
    const wb = mem + 1;
    const row = rows.length;
    const taken = isTaken(record, known);
    rows.push({
      step,
      line: record.line,
      text: known.text,
      cycles: [
        ...span('IF', fetch, id - 1),
        ...span('ID', id, ex - 1),
        { cycle: ex, stage: 'EX', stalled: false },
        { cycle: mem, stage: 'MEM', stalled: false },
        { cycle: wb, stage: 'WB', stalled: false }
      ],
      hazard,
      taken,
      flushedBy: null
    });
    for (const register of known.writes) {
      const load = known.writeBack === 'memory';
      ready.set(register, { cycle: readyAt(known, { ex, mem, wb }, options), producer: row, load });
    }
    stallCycles += ex - id - 1;
    previousEx = ex;
    last = wb;
    if (taken) {
      const address =
        record.line === null ? record.before.registers.pc : addressOfLine(record.line);
      rows.push(...flushedRows(address, program, { id, ex, by: row }));
      flushPenalty = 2;
      fetch = ex + 1;
    } else {
      // The next instruction is fetched as this one moves into ID.
      fetch = id;
    }
  });

  return { rows, cycles: last, instructions: records.length, stallCycles, flushCycles };
}
