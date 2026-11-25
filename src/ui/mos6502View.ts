import type { Program } from '@/core/shared/program';
import { codeByte } from '@/core/mos6502/encode';
import type { Instruction } from '@/core/mos6502/instructions';
import { regionAt } from '@/core/mos6502/memory';
import {
  CODE_BASE,
  DEVICE_BASE,
  STACK_PAGE,
  type CpuState,
  type FlagName
} from '@/core/mos6502/state';
import { hex } from '@/core/mos6502/operands';
import { deviceByte, type AddressFormat, type MemoryPlace, type ShownByte } from './flatMemory';

export const MOS6502_ADDRESSES: AddressFormat = { prefix: '$', digits: 4 };

/** Where the 6502 memory panel can jump to. The top of the stack is the byte above SP. */
export function mos6502MemoryPlaces(state: CpuState): MemoryPlace[] {
  return [
    { label: 'Zero page', start: () => 0x0000 },
    { label: 'Stack', start: () => STACK_PAGE | ((state.registers.sp + 1) & 0xff), stack: true },
    { label: 'Data', start: () => 0x0200 },
    { label: 'Code', start: () => CODE_BASE },
    { label: 'Devices', start: () => DEVICE_BASE },
    { label: 'Vectors', start: () => 0xfff0 }
  ];
}

/** The byte at an address: RAM, the program's machine code, or what a device shows. */
export function byteAt(state: CpuState, program: Program<Instruction>, address: number): ShownByte {
  const region = regionAt(address, program);
  if (region === 'code') return { address, value: codeByte(program, address), region };
  if (region === 'device') {
    return { address, value: deviceByte(state.io, address - DEVICE_BASE), region };
  }
  return { address, value: state.memory[address], region };
}

export const FLAG_INFO: Record<FlagName, { label: string; description: string }> = {
  N: { label: 'Negative', description: 'Bit 7 of the result' },
  V: { label: 'Overflow', description: 'The signed result does not fit, or bit 6 for BIT' },
  D: { label: 'Decimal', description: 'ADC and SBC add and subtract decimal digits' },
  I: { label: 'Interrupt disable', description: 'Interrupt requests are held off' },
  Z: { label: 'Zero', description: 'The result is zero' },
  C: { label: 'Carry', description: 'A carry out of bit 7; for SBC and CMP, no borrow' }
};

/** A bit of P that is not a flag: bit 5, which always reads 1, and B, only in a pushed copy. */
export interface FixedBit {
  bit: 5 | 4;
  label: string;
  value: string;
  description: string;
}

/** P as a byte, as PHP would push it without B: bit 5 always reads 1. */
export const pByteText = (flags: number) => `$${hex((flags | 0x20) & 0xff, 2)}`;

/** P's eight bits, bit 7 first: the six flags, with the two bits that are not flags in place. */
export const P_LAYOUT: readonly (FlagName | FixedBit)[] = [
  'N',
  'V',
  { bit: 5, label: '–', value: '1', description: 'Bit 5 is not a flag: it always reads 1' },
  {
    bit: 4,
    label: 'B',
    value: '–',
    description: 'B is not kept in P: it is 1 only in the copy BRK and PHP push'
  },
  'D',
  'I',
  'Z',
  'C'
];
