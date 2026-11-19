import { cpuError } from '../shared/cpuError';
import { littleEndian } from '../shared/numbers';
import { formatLabel, type Program } from '../shared/program';
import {
  readBytes,
  readPort,
  writeBytes,
  writePort,
  type MemoryWrite,
  type PortWrite
} from '../shared/state';
import { formatHex32, u32 } from './bits';
import { wordAt } from './encode';
import type { Instruction } from './instructions';
import {
  addressOfLine,
  CODE_BASE,
  DEVICE_BASE,
  DEVICE_SPACE,
  INSTRUCTION_SIZE,
  RAM_SIZE,
  type CpuState
} from './state';

/** A load or store moves a byte, a half-word or a word. */
export type AccessSize = 1 | 2 | 4;

/** What sits at an address: the program's code, plain RAM, or a device. */
export type Region = 'code' | 'ram' | 'device';

type Target = { kind: 'code' } | { kind: 'ram' } | { kind: 'device'; port: number };

/** The region an address falls in, or null where nothing is wired. */
export function regionAt(address: number, lineCount: number): Region | null {
  if (address >= DEVICE_BASE && address < DEVICE_BASE + DEVICE_SPACE) return 'device';
  if (address < 0 || address >= RAM_SIZE) return null;
  return address < addressOfLine(lineCount) ? 'code' : 'ram';
}

function locate(
  address: number,
  size: AccessSize,
  codeEnd: number,
  access: 'load' | 'store'
): Target {
  const at = `0x${formatHex32(address)}`;
  if (address % size !== 0) {
    const half = size === 2;
    throw cpuError(
      access === 'load'
        ? half
          ? 'misalignedLoadHalf'
          : 'misalignedLoadWord'
        : half
          ? 'misalignedStoreHalf'
          : 'misalignedStoreWord',
      { at }
    );
  }
  if (address >= DEVICE_BASE && address < DEVICE_BASE + DEVICE_SPACE) {
    if (size !== 1) {
      throw cpuError('deviceByteOnly', { at });
    }
    return { kind: 'device', port: address - DEVICE_BASE };
  }
  if (address + size > RAM_SIZE) {
    throw cpuError('nothingWired', { at });
  }
  return address < codeEnd ? { kind: 'code' } : { kind: 'ram' };
}

/** The bytes of the program's machine code at an address inside it. */
function codeBytes(program: Program<Instruction>, address: number, size: AccessSize): number[] {
  return Array.from({ length: size }, (_, i) => {
    const at = address + i - CODE_BASE;
    const word = wordAt(program, Math.floor(at / INSTRUCTION_SIZE));
    return (word >>> (8 * (at % INSTRUCTION_SIZE))) & 0xff;
  });
}

/** Reads `size` bytes, low byte first, as an unsigned number. */
export function load(
  state: CpuState,
  program: Program<Instruction>,
  address: number,
  size: AccessSize
): number {
  const target = locate(address, size, addressOfLine(program.length), 'load');
  switch (target.kind) {
    case 'device':
      return readPort(state, target.port);
    case 'code':
      return u32(littleEndian(codeBytes(program, address, size)));
    case 'ram':
      return u32(littleEndian(readBytes(state, address, size)));
  }
}

/** What a store changed, for the undo record. */
export interface StoreResult {
  memoryWrites: MemoryWrite[];
  portWrites: PortWrite[];
}

export function store(
  state: CpuState,
  program: Program<Instruction>,
  address: number,
  size: AccessSize,
  value: number
): StoreResult {
  const target = locate(address, size, addressOfLine(program.length), 'store');
  switch (target.kind) {
    case 'device':
      return { memoryWrites: [], portWrites: [writePort(state, target.port, value)] };
    case 'code': {
      const line = Math.floor((address - CODE_BASE) / INSTRUCTION_SIZE);
      throw cpuError('storeIntoCode', {
        address: `0x${formatHex32(address)}`,
        line: formatLabel(line)
      });
    }
    case 'ram': {
      const bytes = Array.from({ length: size }, (_, i) => (value >>> (8 * i)) & 0xff);
      return { memoryWrites: writeBytes(state, address, bytes), portWrites: [] };
    }
  }
}
