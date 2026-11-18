import { CpuError } from '../shared/cpuError';
import { undo } from '../shared/executionRecord';
import type { Program } from '../shared/program';
import { Run, type ExecutionRecord } from './executionContext';
import { HANDLERS } from './handlers';
import { formatInstruction, isValid, type Instruction } from './instructions';
import { addressOfLine } from './layout';
import type { CpuState } from './state';

/**
 * Runs one instruction against `state`. Either the whole instruction takes effect or, if it
 * raises a CpuError, the state is left exactly as it was.
 *
 * `line` is the program line it was fetched from: PC moves past it before it runs, so a jump
 * simply overwrites PC. An instruction run directly (line = null) runs as if it sat at PC, and
 * leaves PC alone unless it jumps.
 */
export function execute(
  state: CpuState,
  instruction: Instruction,
  line: number | null,
  program: Program<Instruction>
): ExecutionRecord {
  if (!isValid(instruction)) {
    throw new CpuError(
      `${formatInstruction(instruction)} isn't a valid 6502 instruction. Remove the last word and pick another.`
    );
  }
  const here = line === null ? state.registers.pc : addressOfLine(program, line);
  const run = new Run(state, program, instruction, here, line);
  try {
    if (line !== null) state.registers.pc = run.next;
    HANDLERS[instruction.mnemonic](run, instruction.operands[0]);
  } catch (error) {
    undo(state, run.record);
    throw error;
  }
  return run.record;
}
