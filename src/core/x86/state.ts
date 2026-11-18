import { truncate } from '../shared/numbers';
import {
  createIo,
  type CpuSnapshot as SharedSnapshot,
  type CpuState as SharedState
} from '../shared/state';
import { FLAGS_RESERVED, flagBit, isFlagSet, type FlagName } from './flags';
import {
  BYTE_REGISTER_LOCATION,
  isByteRegister,
  type RegisterName,
  type WordRegister
} from './registers';

/** 1MB: the 8086 has a 20-bit address bus. */
export const MEMORY_SIZE = 0x100000;

/** The 8086 state: its word registers, FLAGS, 1MB of memory and its ports. */
export type CpuState = SharedState<WordRegister>;

export type CpuSnapshot = SharedSnapshot<WordRegister>;

export function createCpuState(): CpuState {
  return {
    registers: {
      ax: 0,
      bx: 0,
      cx: 0,
      dx: 0,
      si: 0,
      di: 0,
      bp: 0,
      sp: 0xfffe,
      cs: 0x0000,
      ds: 0x1000,
      es: 0x1000,
      ss: 0x2000,
      ip: 0
    },
    flags: FLAGS_RESERVED,
    memory: new Uint8Array(MEMORY_SIZE),
    memoryVersion: 0,
    io: createIo(),
    ioVersion: 0
  };
}

/** Just the registers: enough to read them, e.g. from a snapshot of the CPU before an instruction. */
export type RegisterFile = Pick<CpuState, 'registers'>;

export function readRegister(state: RegisterFile, name: RegisterName): number {
  if (isByteRegister(name)) {
    const { parent, high } = BYTE_REGISTER_LOCATION[name];
    const word = state.registers[parent];
    return high ? word >> 8 : word & 0xff;
  }
  return state.registers[name];
}

export function writeRegister(state: CpuState, name: RegisterName, value: number): void {
  if (isByteRegister(name)) {
    const { parent, high } = BYTE_REGISTER_LOCATION[name];
    const byte = truncate(value, 8);
    const word = state.registers[parent];
    state.registers[parent] = high ? (word & 0x00ff) | (byte << 8) : (word & 0xff00) | byte;
    return;
  }
  state.registers[name] = truncate(value, 16);
}

export function getFlag(state: CpuState, flag: FlagName): boolean {
  return isFlagSet(state.flags, flag);
}

export function setFlag(state: CpuState, flag: FlagName, value: boolean): void {
  const bit = flagBit(flag);
  state.flags = value ? state.flags | bit : state.flags & ~bit;
}

/** segment:offset to a 20-bit physical address (wraps around at 1MB like the 8086). */
export function physicalAddress(segment: number, offset: number): number {
  return ((segment << 4) + truncate(offset, 16)) % MEMORY_SIZE;
}
