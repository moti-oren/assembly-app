import type { Architecture } from '../shared/architecture';
import { EXAMPLE_PROGRAMS } from './examples';
import { execute, type ExecutionRecord } from './execute';
import type { Instruction } from './instructions';
import { addressOfLine, CODE_BASE, createCpuState, INSTRUCTION_SIZE, type CpuState } from './state';

/** RISC-V, RV32I with the M extension. PC is a real byte address: line n is at 4n. */
export const RV32: Architecture<Instruction, CpuState, ExecutionRecord> = {
  id: 'rv32',
  name: 'RISC-V',
  createState: createCpuState,
  execute,
  nextLine: (state) => (state.registers.pc - CODE_BASE) / INSTRUCTION_SIZE,
  setNextLine: (state, line) => {
    state.registers.pc = addressOfLine(line);
  },
  examples: EXAMPLE_PROGRAMS
};
