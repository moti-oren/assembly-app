import type { Program } from '@/core/shared/program';
import { codeByte } from '@/core/mos6502/encode';
import type { Instruction } from '@/core/mos6502/instructions';
import { regionAt } from '@/core/mos6502/memory';
import { CODE_BASE, DEVICE_BASE, STACK_PAGE, type CpuState } from '@/core/mos6502/state';
import { deviceByte, type AddressFormat, type MemoryPlace, type ShownByte } from './flatMemory';

export const MOS6502_ADDRESSES: AddressFormat = { prefix: '$', digits: 4 };

/** Where the 6502 memory panel can jump to. The top of the stack is the byte above SP. */
export function mos6502MemoryPlaces(state: CpuState): MemoryPlace[] {
  return [
    { id: 'zeroPage', start: () => 0x0000 },
    { id: 'stack', start: () => STACK_PAGE | ((state.registers.sp + 1) & 0xff), stack: true },
    { id: 'data', start: () => 0x0200 },
    { id: 'code', start: () => CODE_BASE },
    { id: 'devices', start: () => DEVICE_BASE },
    { id: 'vectors', start: () => 0xfff0 }
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
