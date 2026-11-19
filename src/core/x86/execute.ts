import { CpuError } from '../shared/cpuError';
import { undo, type ExecutionRecord as SharedRecord } from '../shared/executionRecord';
import { snapshot } from '../shared/state';
import { DIVIDE_ERROR_INTERRUPT, ExecutionContext, type AluTrace } from './executionContext';
import { HANDLERS } from './handlers';
import { formatInstruction, instructionSize, isValid, type Instruction } from './instructions';
import { DivideError } from './multiplyDivide';
import type { RegisterName, WordRegister } from './registers';
import { writeRegister, type CpuState } from './state';
import { repeat } from './stringInstructions';

/** An executed 8086 instruction: what undo needs, and what explains the instruction afterwards. */
export interface ExecutionRecord extends SharedRecord<Instruction, WordRegister> {
  /** Null when the instruction computed nothing in the ALU, e.g. MOV, a jump, or a shift by 0. */
  alu: AluTrace | null;
  /** The interrupt the instruction entered (INT n, INTO, a divide error), or null. */
  interrupt: number | null;
  /**
   * Registers the instruction wrote, whether or not the value changed: byte registers by their
   * own name (AL, not AX), each once. The fetch moving IP to the next line is not one of them.
   */
  registersWritten: RegisterName[];
}

/**
 * Runs one instruction against `state`. Either the whole instruction takes effect or,
 * if it raises a CpuError, the state is left exactly as it was.
 *
 * `line` is the program line the instruction was fetched from. As on a real CPU, IP is
 * advanced to the next line before the instruction runs, so jumps simply overwrite it and
 * CALL pushes the right return address. Instructions run directly (line = null) leave IP alone.
 */
export function execute(
  state: CpuState,
  instruction: Instruction,
  line: number | null = null
): ExecutionRecord {
  if (!isValid(instruction)) {
    throw new CpuError(
      `${formatInstruction(instruction)} isn't a valid 8086 instruction. Remove the last word and pick again.`
    );
  }

  const ctx = new ExecutionContext(state, instructionSize(instruction) ?? 16);
  const record: ExecutionRecord = {
    instruction,
    line,
    before: snapshot(state),
    memoryWrites: ctx.memoryWrites,
    portWrites: ctx.portWrites,
    alu: null,
    interrupt: null,
    registersWritten: ctx.registersWritten
  };

  try {
    if (line !== null) {
      writeRegister(state, 'ip', line + 1);
    }
    const handler = HANDLERS[instruction.mnemonic];
    try {
      if (instruction.prefix) {
        repeat(ctx, instruction.prefix, () => handler(ctx, instruction.operands));
      } else {
        handler(ctx, instruction.operands);
      }
    } catch (error) {
      // DIV and IDIV raise the error before changing anything, so the interrupt starts clean.
      const handled = error instanceof DivideError && ctx.handler(DIVIDE_ERROR_INTERRUPT);
      if (!handled) throw error;
      ctx.interrupt(DIVIDE_ERROR_INTERRUPT);
    }
    record.interrupt = ctx.interrupted;
    record.alu = ctx.alu;
  } catch (error) {
    undo(state, record);
    throw error;
  }

  return record;
}
