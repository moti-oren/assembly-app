import { PORTS } from '@/core/shared/devices';
import type { Program } from '@/core/shared/program';
import { wordAt } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { regionAt, type Region } from '@/core/rv32/memory';
import { ABI_NAMES, registerKey, registerRole, type RegisterRole } from '@/core/rv32/registers';
import {
  CODE_BASE,
  DATA_BASE,
  DEVICE_BASE,
  INSTRUCTION_SIZE,
  type CpuState
} from '@/core/rv32/state';

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
export function wasWritten(record: ExecutionRecord | null, index: number): boolean {
  return record?.registersWritten.includes(registerKey(index)) ?? false;
}

/** The places in memory the memory panel can jump to. */
export const MEMORY_PLACES = {
  code: { label: 'Code', start: CODE_BASE },
  data: { label: 'Data', start: DATA_BASE },
  stack: { label: 'Stack', start: null },
  devices: { label: 'Devices', start: DEVICE_BASE }
} as const;

export type MemoryPlace = keyof typeof MEMORY_PLACES;

/** The switches are an input: the panel shows what they present, not what was written there. */
const INPUT_PORTS = new Set<number>([PORTS.switches]);

/** One byte of memory as the panel shows it; null where nothing is wired. */
export interface ShownByte {
  address: number;
  value: number | null;
  region: Region | null;
}

/** The byte at an address: RAM, the program's machine code, or what a device shows. */
export function byteAt(state: CpuState, program: Program<Instruction>, address: number): ShownByte {
  const region = regionAt(address, program.length);
  if (region === 'ram') return { address, value: state.memory[address], region };
  if (region === 'code') {
    const offset = address - CODE_BASE;
    const word = wordAt(program, Math.floor(offset / INSTRUCTION_SIZE));
    return { address, value: (word >>> (8 * (offset % INSTRUCTION_SIZE))) & 0xff, region };
  }
  if (region === 'device') {
    const port = address - DEVICE_BASE;
    const value = INPUT_PORTS.has(port) ? state.io.in[port] : state.io.out[port];
    return { address, value, region };
  }
  return { address, value: null, region: null };
}

/** `count` rows of 16 bytes, from `start` rounded down to a row. */
export function memoryRows(
  state: CpuState,
  program: Program<Instruction>,
  start: number,
  count: number
): ShownByte[][] {
  const first = Math.floor(start / 16) * 16;
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: 16 }, (_, column) => byteAt(state, program, first + 16 * row + column))
  );
}
