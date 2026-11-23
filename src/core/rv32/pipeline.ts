import { isLabel, type Program } from '../shared/program';
import { branchPredictor, type BranchPredictor, type PredictorKind } from './branchPredictor';
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
 * a loaded value one cycle later; branches and jumps are resolved in EX. Until then the CPU keeps
 * fetching: behind a jump the next lines, and behind a conditional branch what its predictor
 * guesses, the next lines or the branch's target (which it is taken to know while fetching, as
 * from a branch target buffer). A jump, and a branch guessed wrong, flush the two instructions
 * fetched behind them.
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

/**
 * A result an instruction took straight from a later stage, because the instruction that produced
 * it had not written it back yet when this one read its registers.
 */
export interface Forward {
  register: number;
  /** The row of the instruction that produced it. */
  producer: number;
  /** The stage the producer is in during this instruction's EX, when the value is handed over. */
  from: 'MEM' | 'WB';
}

export interface Prediction {
  guess: boolean;
  taken: boolean;
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
  /** The operands that reached its EX by forwarding; none when forwarding is off. */
  forwards: Forward[];
  /** A jump, or a branch guessed wrong: the two instructions fetched behind it are flushed. */
  flushes: boolean;
  /** For a conditional branch: what the predictor guessed, and what the branch did. */
  prediction: Prediction | null;
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
   * Cycles lost refetching after jumps and branches guessed wrong: two each, except for one at
   * the very end, where nothing waits behind it.
   */
  flushCycles: number;
  /** Conditional branches that ran, and how many of them the predictor guessed wrong. */
  branches: number;
  mispredicted: number;
}

export interface PipelineOptions {
  forwarding: boolean;
  predictor: PredictorKind;
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

/**
 * What the predictor guessed for a conditional branch, which then learns what it did. A real one
 * learns only when the branch decides in EX, after the next instruction was fetched; learning at
 * once gives the same guesses for these predictors, whose guess a right guess never changes.
 */
function predict(
  predictor: BranchPredictor,
  record: ExecutionRecord,
  { nextPc }: Decoded,
  address: number
): Prediction | null {
  if (nextPc !== 'branch') return null;
  const taken = record.comparison?.taken === true;
  const guess = predictor.guess(address);
  predictor.learn(address, taken);
  return { guess, taken };
}

/**
 * Where the CPU fetched from behind the instruction at `address`, wrongly: a branch's target when
 * it was guessed taken, and the next line otherwise.
 */
function wrongPath(instruction: Instruction, prediction: Prediction | null, address: number) {
  const target = instruction.operands.find(isLabel);
  if (prediction?.guess && target) return addressOfLine(target.target);
  return address + INSTRUCTION_SIZE;
}

/** The line at an address, if the program has one there. */
function lineOf(address: number, program: Program<Instruction>): number | null {
  const line = lineAt(address, program.length);
  return line !== null && line < program.length ? line : null;
}

/**
 * The two instructions fetched from `first` on behind a jump or a branch guessed wrong, while it
 * went through ID and EX: the first gets as far as ID, the second only into IF, and both are
 * flushed.
 */
function flushedRows(
  first: number,
  program: Program<Instruction>,
  { id, ex, by }: { id: number; ex: number; by: number }
): PipelineRow[] {
  const behind = [first, first + INSTRUCTION_SIZE];
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
      forwards: [],
      flushes: false,
      prediction: null,
      flushedBy: by
    };
  });
}

/** When a value written to `register` can be used by a later instruction's EX. */
function readyAt(
  { writeBack }: Decoded,
  { ex, mem, wb }: { ex: number; mem: number; wb: number },
  { forwarding }: Pick<PipelineOptions, 'forwarding'>
): number {
  if (!forwarding) return wb + 1;
  return writeBack === 'memory' ? mem + 1 : ex + 1;
}

type Ready = Map<number, { cycle: number; producer: number; load: boolean; wb: number }>;

/** When an instruction that entered ID in cycle `id` reaches EX, and the operand it waited for. */
function waitFor(reads: readonly number[], ready: Ready, id: number) {
  let ex = id + 1;
  let hazard: DataHazard | null = null;
  for (const register of reads) {
    const value = ready.get(register);
    if (register === 0 || !value || value.cycle <= ex) continue;
    ex = value.cycle;
    hazard = { register, producer: value.producer, load: value.load, cycles: ex - id - 1 };
  }
  return { ex, hazard };
}

/**
 * Registers are read at the end of ID. A value written back by then comes from the register
 * file; a newer one is still in the pipeline, and can only have come by forwarding.
 */
function forwardsInto(reads: readonly number[], ready: Ready, ex: number): Forward[] {
  const forwards: Forward[] = [];
  for (const register of new Set(reads)) {
    const value = ready.get(register);
    if (register === 0 || !value || value.wb < ex) continue;
    forwards.push({ register, producer: value.producer, from: value.wb === ex ? 'WB' : 'MEM' });
  }
  return forwards;
}

/** The cycles of an instruction fetched in `fetch` that enters ID in `id` and EX in `ex`. */
function stages(fetch: number, id: number, ex: number): StageCycle[] {
  return [
    ...span('IF', fetch, id - 1),
    ...span('ID', id, ex - 1),
    { cycle: ex, stage: 'EX', stalled: false },
    { cycle: ex + 1, stage: 'MEM', stalled: false },
    { cycle: ex + 2, stage: 'WB', stalled: false }
  ];
}

/** Notes when what row `row` writes can reach a later instruction's EX. */
function produce(
  known: Decoded,
  row: number,
  ex: number,
  ready: Ready,
  options: PipelineOptions
): void {
  const at = { ex, mem: ex + 1, wb: ex + 2 };
  for (const register of known.writes) {
    const load = known.writeBack === 'memory';
    ready.set(register, { cycle: readyAt(known, at, options), producer: row, load, wb: at.wb });
  }
}

export function pipelineTiming(
  records: readonly ExecutionRecord[],
  program: Program<Instruction>,
  options: PipelineOptions
): PipelineTiming {
  const rows: PipelineRow[] = [];
  /** For each register, when its newest value can reach EX, and who produces it. */
  const ready: Ready = new Map();
  const predictor = branchPredictor(options.predictor);
  let fetch = 1;
  let previousEx = 0;
  /** Set by a flush: what the next instruction loses to it. */
  let flushPenalty = 0;
  const totals = { stallCycles: 0, flushCycles: 0, branches: 0, mispredicted: 0 };
  let last = 0;

  records.forEach((record, step) => {
    const known = decodeOnce(record.instruction);
    totals.flushCycles += flushPenalty;
    flushPenalty = 0;
    // ID is free once the instruction ahead has moved on to EX.
    const id = Math.max(fetch + 1, previousEx);
    const { ex, hazard } = waitFor(known.reads, ready, id);
    const row = rows.length;
    const address = record.line === null ? record.before.registers.pc : addressOfLine(record.line);
    const prediction = predict(predictor, record, known, address);
    const missed = prediction !== null && prediction.guess !== prediction.taken;
    const flushes = known.nextPc === 'jump' || missed;
    rows.push({
      step,
      line: record.line,
      text: known.text,
      cycles: stages(fetch, id, ex),
      hazard,
      forwards: forwardsInto(known.reads, ready, ex),
      flushes,
      prediction,
      flushedBy: null
    });
    produce(known, row, ex, ready, options);
    totals.stallCycles += ex - id - 1;
    if (prediction) totals.branches += 1;
    if (missed) totals.mispredicted += 1;
    previousEx = ex;
    last = ex + 2;
    if (flushes) {
      const first = wrongPath(record.instruction, prediction, address);
      rows.push(...flushedRows(first, program, { id, ex, by: row }));
      flushPenalty = 2;
      fetch = ex + 1;
    } else {
      // What comes next, in the program or at a target guessed right, is fetched as this one
      // moves into ID.
      fetch = id;
    }
  });

  return { rows, cycles: last, instructions: records.length, ...totals };
}
