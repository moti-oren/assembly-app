import { FLAG_BITS, FLAGS_RESERVED, type FlagName } from './flags';
import { truncate, type Size } from './numbers';
import {
  BYTE_REGISTER_LOCATION,
  isByteRegister,
  type RegisterName,
  type WordRegister
} from './registers';

/** 1MB: the 8086 has a 20-bit address bus. */
export const MEMORY_SIZE = 0x100000;

export interface CpuState {
  /** The single source of truth for every register; 8-bit registers are views into it. */
  registers: Record<WordRegister, number>;
  flags: number;
  memory: Uint8Array;
  /** Bumped on every memory write so UI frameworks can track changes to `memory`. */
  memoryVersion: number;
}

export interface MemoryWrite {
  address: number;
  before: number;
  after: number;
}

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
    memoryVersion: 0
  };
}

export function readRegister(state: CpuState, name: RegisterName): number {
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
  return (state.flags & (1 << FLAG_BITS[flag])) !== 0;
}

export function setFlag(state: CpuState, flag: FlagName, value: boolean): void {
  const bit = 1 << FLAG_BITS[flag];
  state.flags = value ? state.flags | bit : state.flags & ~bit;
}

/** segment:offset to a 20-bit physical address (wraps around at 1MB like the 8086). */
export function physicalAddress(segment: number, offset: number): number {
  return ((segment << 4) + truncate(offset, 16)) % MEMORY_SIZE;
}

/** Little-endian read of a byte or a word. */
export function readMemory(state: CpuState, address: number, size: Size): number {
  const low = state.memory[address % MEMORY_SIZE];
  if (size === 8) {
    return low;
  }
  return low | (state.memory[(address + 1) % MEMORY_SIZE] << 8);
}

/** Little-endian write of a byte or a word. Returns what changed, for undo and highlighting. */
export function writeMemory(
  state: CpuState,
  address: number,
  size: Size,
  value: number
): MemoryWrite[] {
  const bytes = size === 8 ? [value & 0xff] : [value & 0xff, (value >> 8) & 0xff];
  const writes = bytes.map((after, i) => {
    const target = (address + i) % MEMORY_SIZE;
    const before = state.memory[target];
    state.memory[target] = after;
    return { address: target, before, after };
  });
  state.memoryVersion++;
  return writes;
}
