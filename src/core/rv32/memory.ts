import { CpuError } from '../shared/cpuError';
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
type Target = { kind: 'code' } | { kind: 'ram' } | { kind: 'device'; port: number };

const SIZE_NAMES: Record<AccessSize, string> = { 1: 'byte', 2: 'half-word', 4: 'word' };

function locate(address: number, size: AccessSize, codeEnd: number, access: string): Target {
  const at = `0x${formatHex32(address)}`;
  if (address % size !== 0) {
    throw new CpuError(
      `Misaligned ${access}: a ${SIZE_NAMES[size]} must start at a multiple of ${size}, and ${at} is not. This CPU traps instead of splitting the access.`
    );
  }
  if (address >= DEVICE_BASE && address < DEVICE_BASE + DEVICE_SPACE) {
    if (size !== 1) {
      throw new CpuError(
        `Access fault: the devices at ${at} are one byte each. Use LB, LBU or SB.`
      );
    }
    return { kind: 'device', port: address - DEVICE_BASE };
  }
  if (address + size > RAM_SIZE) {
    throw new CpuError(
      `Access fault: nothing is wired at ${at}. RAM is 0x00000000 to 0x000FFFFF, the devices start at 0x10000000.`
    );
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
      throw new CpuError(
        `Store into code: 0x${formatHex32(address)} holds ${formatLabel(line)}. This playground runs the program as a list of lines, so a program cannot change its own code.`
      );
    }
    case 'ram': {
      const bytes = Array.from({ length: size }, (_, i) => (value >>> (8 * i)) & 0xff);
      return { memoryWrites: writeBytes(state, address, bytes), portWrites: [] };
    }
  }
}
