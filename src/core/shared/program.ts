import { CpuError, cpuError } from './cpuError';
import type { ExecutionRecord } from './executionRecord';

/**
 * A program is a list of instructions, one per line (L0, L1, ...). Jump targets, and lines used
 * as values, are line indexes. The CPU runs the lines as data; how its instruction pointer turns
 * into a line is up to each architecture.
 */
export type Program<Instruction> = readonly Instruction[];

/** An operand that names a program line. */
export interface LabelOperand {
  type: 'label';
  target: number;
}

/** How every architecture writes a program line: L0, L1, ... */
export function formatLabel(target: number): string {
  return `L${target}`;
}

/** What the program code needs of an instruction: operands it can look through for labels. */
export interface ProgramInstruction {
  readonly operands: readonly { readonly type: string }[];
}

/** What stepping and running need of an architecture. */
export interface LineRunner<Instruction, State, Record> {
  /**
   * Runs one instruction. `line` is the program line it was fetched from, or null when it is run
   * directly. On a CpuError the state is left exactly as it was.
   */
  execute(
    state: State,
    instruction: Instruction,
    line: number | null,
    program: Program<Instruction>
  ): Record;
  /** The program line the instruction pointer points at; program.length or more means "done". */
  nextLine(state: State, program: Program<Instruction>): number;
}

/** Stops runaway loops when running a whole program. */
const MAX_STEPS = 10_000;

/**
 * Stops a run whose records would hold too many memory writes. Every written byte is kept for
 * undo, and one 8086 REP with a full CX writes 65535 of them, so MAX_STEPS alone does not bound
 * memory.
 */
export const MAX_RUN_WRITES = 1_000_000;

export function tooManyWrites(maxWrites = MAX_RUN_WRITES): CpuError {
  return cpuError('tooManyWrites', { count: maxWrites });
}

export function isLabel(operand: { readonly type: string }): operand is LabelOperand {
  return operand.type === 'label';
}

function mapTargets<I extends ProgramInstruction>(
  instruction: I,
  map: (target: number) => number
): I {
  if (!instruction.operands.some(isLabel)) {
    return instruction;
  }
  const operands = instruction.operands.map((operand) =>
    isLabel(operand) ? { ...operand, target: map(operand.target) } : operand
  );
  return { ...instruction, operands };
}

/**
 * Inserts `instruction` before line `index`. Labels pointing at `index` or later keep pointing
 * at the same instructions (they shift down by one), so existing jumps stay correct. The new
 * instruction's own labels refer to the program as it was before the insert, and shift the same way.
 */
export function insertLine<I extends ProgramInstruction>(
  program: Program<I>,
  index: number,
  instruction: I
): I[] {
  const shift = (target: number) => (target >= index ? target + 1 : target);
  const shifted = program.map((line) => mapTargets(line, shift));
  return [...shifted.slice(0, index), mapTargets(instruction, shift), ...shifted.slice(index)];
}

/** Removes line `index`. Jumps that pointed at it now point at the line that took its place. */
export function removeLine<I extends ProgramInstruction>(program: Program<I>, index: number): I[] {
  return program
    .filter((_, i) => i !== index)
    .map((line) => mapTargets(line, (target) => (target > index ? target - 1 : target)));
}

/** The line to run next after inserting a line, so the same instruction still runs next. */
export function lineAfterInsert(next: number, index: number): number {
  return next > index ? next + 1 : next;
}

export function lineAfterRemove(next: number, index: number): number {
  return next > index ? next - 1 : next;
}

export function isFinished<I, S>(
  cpu: LineRunner<I, S, unknown>,
  state: S,
  program: Program<I>
): boolean {
  return cpu.nextLine(state, program) >= program.length;
}

/** Runs the line the instruction pointer points at. */
export function step<I, S, R>(cpu: LineRunner<I, S, R>, state: S, program: Program<I>): R {
  const line = cpu.nextLine(state, program);
  if (line >= program.length) {
    throw cpuError('endOfProgram');
  }
  return cpu.execute(state, program[line], line, program);
}

/**
 * Runs to the end of the program. Returns the records of every executed line, even when it stops
 * early because of an error (`error`) or because it hit MAX_STEPS or MAX_RUN_WRITES.
 */
export function runToEnd<I, S, R extends ExecutionRecord>(
  cpu: LineRunner<I, S, R>,
  state: S,
  program: Program<I>,
  maxSteps = MAX_STEPS,
  maxWrites = MAX_RUN_WRITES
): { records: R[]; error: CpuError | null } {
  const records: R[] = [];
  let writes = 0;
  while (!isFinished(cpu, state, program)) {
    if (records.length >= maxSteps) {
      return {
        records,
        error: cpuError('tooManySteps', { count: maxSteps })
      };
    }
    if (writes >= maxWrites) {
      return { records, error: tooManyWrites(maxWrites) };
    }
    try {
      const record = step(cpu, state, program);
      records.push(record);
      writes += record.memoryWrites.length;
    } catch (caught) {
      if (caught instanceof CpuError) {
        return { records, error: caught };
      }
      throw caught;
    }
  }
  return { records, error: null };
}
