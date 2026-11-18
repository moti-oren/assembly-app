import { createIo, type CpuState as SharedState } from '../shared/state';
import { u32 } from './bits';
import { registerKey, REGISTER_KEYS, SP, type RegisterName } from './registers';

/**
 * The memory map. Addresses are 32 bits, but only these ranges hold anything; an access anywhere
 * else is an access fault, as on a real board with nothing wired at that address.
 * - 0x00000000: 1MB of RAM. The program's code sits at its start, 4 bytes per line.
 * - 0x10000000: the devices, one byte each, at the same offsets as the 8086's port numbers.
 */
export const RAM_SIZE = 0x100000;
export const CODE_BASE = 0x00000000;
/** Where the examples keep their data, well clear of the code. */
export const DATA_BASE = 0x00010000;
/** The stack grows down from the top of RAM; the first word pushed lands just below it. */
export const STACK_TOP = RAM_SIZE;
export const DEVICE_BASE = 0x10000000;
export const DEVICE_SPACE = 0x100;

/** Every RISC-V instruction is 4 bytes, so line n starts at CODE_BASE + 4n. */
export const INSTRUCTION_SIZE = 4;

export type CpuState = SharedState<RegisterName>;

export function createCpuState(): CpuState {
  const registers = Object.fromEntries(REGISTER_KEYS.map((key) => [key, 0])) as Record<
    RegisterName,
    number
  >;
  registers[registerKey(SP)] = STACK_TOP;
  registers.pc = CODE_BASE;
  return {
    registers,
    flags: 0,
    memory: new Uint8Array(RAM_SIZE),
    memoryVersion: 0,
    io: createIo(),
    ioVersion: 0
  };
}

/** x0 always reads as 0. */
export function readRegister(state: Pick<CpuState, 'registers'>, index: number): number {
  return index === 0 ? 0 : state.registers[registerKey(index)];
}

/** Writes to x0 are thrown away: that is how RISC-V discards a result it does not need. */
export function writeRegister(state: CpuState, index: number, value: number): void {
  if (index !== 0) state.registers[registerKey(index)] = u32(value);
}

export function addressOfLine(line: number): number {
  return CODE_BASE + INSTRUCTION_SIZE * line;
}

/** The program line at a code address, or null when the address is not the start of one. */
export function lineAt(address: number, lineCount: number): number | null {
  const offset = address - CODE_BASE;
  if (offset < 0 || offset % INSTRUCTION_SIZE !== 0) return null;
  const line = offset / INSTRUCTION_SIZE;
  return line <= lineCount ? line : null;
}
