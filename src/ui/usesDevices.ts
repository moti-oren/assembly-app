import type { ExecutionRecord as Rv32Record } from '@/core/rv32/execute';
import type { Instruction as Rv32Instruction } from '@/core/rv32/instructions';
import { DEVICE_BASE } from '@/core/rv32/state';
import type { ExecutionRecord as Mos6502Record } from '@/core/mos6502/executionContext';
import type { Instruction as Mos6502Instruction } from '@/core/mos6502/instructions';
import {
  DEVICE_BASE as MOS6502_DEVICE_BASE,
  DEVICE_SPACE as MOS6502_DEVICE_SPACE
} from '@/core/mos6502/state';
import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';

/** On the 8086 the devices are behind ports, so IN and OUT are the instructions that use them. */
export function x86UsesDevices(
  program: readonly Instruction[],
  last: ExecutionRecord | null
): boolean {
  const usesPort = (instruction: Instruction) => decode(instruction).port !== null;
  return program.some(usesPort) || (last !== null && usesPort(last.instruction));
}

/**
 * On RISC-V any load or store can reach a device, so a program counts as using them when it
 * loads their base address into a register (LUI 0x10000), or the last access went to one.
 */
export function rv32UsesDevices(
  program: readonly Rv32Instruction[],
  last: Rv32Record | null
): boolean {
  const devicesHigh = DEVICE_BASE >>> 12;
  const loadsBase = program.some(
    ({ mnemonic, operands }) =>
      mnemonic === 'lui' && operands[1]?.type === 'imm' && operands[1].value === devicesHigh
  );
  return loadsBase || last?.access?.region === 'device';
}

/** On the 6502 the devices are memory too: a program uses them when it names one of their addresses. */
export function mos6502UsesDevices(
  program: readonly Mos6502Instruction[],
  last: Mos6502Record | null
): boolean {
  const isDevice = (address: number) =>
    address >= MOS6502_DEVICE_BASE && address < MOS6502_DEVICE_BASE + MOS6502_DEVICE_SPACE;
  const namesOne = program.some(
    ({ operands: [operand] }) => operand?.type === 'abs' && isDevice(operand.address)
  );
  return namesOne || last?.access?.region === 'device';
}
