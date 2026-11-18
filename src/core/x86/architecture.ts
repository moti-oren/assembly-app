import type { Architecture } from '../shared/architecture';
import { EXAMPLE_PROGRAMS } from './examples';
import { execute, type ExecutionRecord } from './execute';
import type { Instruction } from './instructions';
import { createCpuState, type CpuState } from './state';

/** The 8086. Its IP holds the index of the next program line, not a byte address. */
export const X86: Architecture<Instruction, CpuState, ExecutionRecord> = {
  id: 'x86',
  name: '8086',
  createState: createCpuState,
  execute: (state, instruction, line) => execute(state, instruction, line),
  nextLine: (state) => state.registers.ip,
  setNextLine: (state, line) => {
    state.registers.ip = line;
  },
  examples: EXAMPLE_PROGRAMS
};
