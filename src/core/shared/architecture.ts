import type { ExecutionRecord } from './executionRecord';
import type { LineRunner, Program, ProgramInstruction } from './program';
import type { CpuState } from './state';

export interface Example<Instruction> {
  name: string;
  description: string;
  program: Program<Instruction>;
}

/**
 * One CPU architecture, as the rest of the app runs it: its state, how it executes a program
 * line, and where its instruction pointer is in the program.
 */
export interface Architecture<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
> extends LineRunner<Instruction, State, Record> {
  /** Short and stable, for storage keys: `x86`. */
  readonly id: string;
  /** The name the app shows: `8086`. */
  readonly name: string;
  createState(): State;
  /** Whether an instruction is one this CPU has, with operands it accepts. */
  isValid(instruction: Instruction): boolean;
  /** Points the instruction pointer at a program line, e.g. after the program was edited. */
  setNextLine(state: State, line: number, program: Program<Instruction>): void;
  readonly examples: readonly Example<Instruction>[];
}
