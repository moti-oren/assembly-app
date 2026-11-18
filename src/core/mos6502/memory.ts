import { CpuError } from '../shared/cpuError';
import type { Program } from '../shared/program';
import { readPort, writePort, type MemoryWrite, type PortWrite } from '../shared/state';
import { codeByte } from './encode';
import type { Instruction } from './instructions';
import { codeEnd, lineAt } from './layout';
import { hex } from './operands';
import { CODE_BASE, DEVICE_BASE, DEVICE_SPACE, type CpuState } from './state';

/** What sits at an address: the program's code, plain RAM, or a device. */
export type Region = 'code' | 'ram' | 'device';

export function regionAt(address: number, program: Program<Instruction>): Region {
  if (address >= DEVICE_BASE && address < DEVICE_BASE + DEVICE_SPACE) return 'device';
  return address >= CODE_BASE && address < codeEnd(program) ? 'code' : 'ram';
}

/** Reads one byte: RAM, the program's machine code, or what a device presents. */
export function readByte(state: CpuState, program: Program<Instruction>, address: number): number {
  const at = address & 0xffff;
  switch (regionAt(at, program)) {
    case 'device':
      return readPort(state, at - DEVICE_BASE);
    case 'code':
      return codeByte(program, at);
    case 'ram':
      return state.memory[at];
  }
}

/** What a write changed, for the undo record. */
export interface WriteResult {
  memoryWrites: MemoryWrite[];
  portWrites: PortWrite[];
}

export function writeByte(
  state: CpuState,
  program: Program<Instruction>,
  address: number,
  value: number
): WriteResult {
  const at = address & 0xffff;
  switch (regionAt(at, program)) {
    case 'device':
      return { memoryWrites: [], portWrites: [writePort(state, at - DEVICE_BASE, value)] };
    case 'code': {
      const line = lineAt(program, at);
      const where = line === null ? 'the middle of a line' : `L${line}`;
      throw new CpuError(
        `Write into code: $${hex(at, 4)} is ${where} of the program. This playground runs the program as a list of lines, so a program cannot change its own code.`
      );
    }
    case 'ram': {
      const before = state.memory[at];
      state.memory[at] = value & 0xff;
      state.memoryVersion++;
      return { memoryWrites: [{ address: at, before, after: value & 0xff }], portWrites: [] };
    }
  }
}
