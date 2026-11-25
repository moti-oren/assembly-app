import type { Program } from '@/core/shared/program';
import { wordAt } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { s32 } from '@/core/rv32/bits';
import { regionAt } from '@/core/rv32/memory';
import { ABI_NAMES, registerKey, registerRole, SP, type RegisterRole } from '@/core/rv32/registers';
import {
  CODE_BASE,
  DATA_BASE,
  DEVICE_BASE,
  INSTRUCTION_SIZE,
  readRegister,
  type CpuState
} from '@/core/rv32/state';
import { deviceByte, type AddressFormat, type MemoryPlace, type ShownByte } from './flatMemory';

/** One of the 32 registers, as the panels list it. */
export interface RegisterRow {
  index: number;
  key: ReturnType<typeof registerKey>;
  abi: string;
}

const ROLE_ORDER: RegisterRole[] = ['special', 'argument', 'temporary', 'saved'];

export const ROLE_LABELS: Record<RegisterRole, string> = {
  special: 'Special',
  argument: 'Arguments',
  temporary: 'Temporaries',
  saved: 'Saved'
};

export const ROLE_DESCRIPTIONS: Record<RegisterRole, string> = {
  special: 'zero always reads 0; ra holds the return address, sp the top of the stack',
  argument: 'Arguments of a call, and its results in a0 and a1. A call may change them',
  temporary: 'Free to use; a call may change them',
  saved: 'A function that uses them must put them back before it returns'
};

/**
 * The registers in groups by what the calling convention uses them for. The special ones keep
 * their numbers' order (zero, ra, sp, gp, tp); the others go by name, t0 to t6 and so on.
 */
export const REGISTER_GROUPS: { role: RegisterRole; rows: RegisterRow[] }[] = ROLE_ORDER.map(
  (role) => {
    const rows = ABI_NAMES.map((abi, index) => ({ index, key: registerKey(index), abi })).filter(
      ({ index }) => registerRole(index) === role
    );
    if (role !== 'special')
      rows.sort((a, b) => a.abi.localeCompare(b.abi, 'en', { numeric: true }));
    return { role, rows };
  }
);

/** Whether the last instruction wrote register `index`, whether or not its value changed. */
export function rv32RegisterWritten(record: ExecutionRecord | null, index: number): boolean {
  return record?.registersWritten.includes(registerKey(index)) ?? false;
}

/** Where the RISC-V memory panel can jump to. */
export function rv32MemoryPlaces(state: CpuState): MemoryPlace[] {
  return [
    { label: 'Code', start: () => CODE_BASE },
    { label: 'Data', start: () => DATA_BASE },
    { label: 'Stack', start: () => readRegister(state, SP), stack: true },
    { label: 'Devices', start: () => DEVICE_BASE }
  ];
}

export const RV32_ADDRESSES: AddressFormat = { prefix: '0x', digits: 8 };

/** The byte at an address: RAM, the program's machine code, or what a device shows. */
export function byteAt(state: CpuState, program: Program<Instruction>, address: number): ShownByte {
  const region = regionAt(address, program.length);
  if (region === 'ram') return { address, value: state.memory[address], region };
  if (region === 'code') {
    const offset = address - CODE_BASE;
    const word = wordAt(program, Math.floor(offset / INSTRUCTION_SIZE));
    return { address, value: (word >>> (8 * (offset % INSTRUCTION_SIZE))) & 0xff, region };
  }
  if (region === 'device')
    return { address, value: deviceByte(state.io, address - DEVICE_BASE), region };
  return { address, value: null, region: null };
}

/** A register read as a signed number, with a true minus sign as the number topic writes it. */
export function signedText(value: number): string {
  return String(s32(value)).replace('-', '−');
}
