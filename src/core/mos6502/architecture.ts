import type { Architecture } from '../shared/architecture';
import { EXAMPLE_PROGRAMS } from './examples';
import { execute } from './execute';
import type { ExecutionRecord } from './executionContext';
import { isValid, type Instruction } from './instructions';
import { addressOfLine, lineAt } from './layout';
import { createCpuState, type CpuState } from './state';

/** The MOS 6502 (NMOS). PC is a real address; a line's address depends on the lines before it. */
export const MOS6502: Architecture<Instruction, CpuState, ExecutionRecord> = {
  id: 'mos6502',
  name: '6502',
  createState: createCpuState,
  isValid,
  execute,
  // Jumps only ever land on the start of a line, so PC is always one of them.
  nextLine: (state, program) => lineAt(program, state.registers.pc) ?? program.length,
  setNextLine: (state, line, program) => {
    state.registers.pc = addressOfLine(program, line);
  },
  examples: EXAMPLE_PROGRAMS
};
