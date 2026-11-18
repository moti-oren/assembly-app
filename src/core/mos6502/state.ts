import { createIo, type CpuState as SharedState } from '../shared/state';

/**
 * The MOS 6502: three 8-bit registers (A, X, Y), an 8-bit stack pointer into page $01, a 16-bit
 * PC, and the status register P, kept in the shared `flags`.
 */
export type RegisterName = 'a' | 'x' | 'y' | 'sp' | 'pc';

export const REGISTER_NAMES: readonly RegisterName[] = ['a', 'x', 'y', 'sp', 'pc'];

export type CpuState = SharedState<RegisterName>;

/**
 * The memory map. All 64K is RAM, apart from the devices.
 * - $0000–$00FF: the zero page, reached by the shorter, faster zero-page modes.
 * - $0100–$01FF: the stack. SP is the low byte of the next free slot; it grows down.
 * - $0600: where the program's code starts.
 * - $D000: the devices, one byte each, at the same offsets as the 8086's port numbers.
 * - $FFFA–$FFFF: the NMI, RESET and IRQ/BRK vectors.
 */
export const MEMORY_SIZE = 0x10000;
export const STACK_PAGE = 0x0100;
export const CODE_BASE = 0x0600;
export const DEVICE_BASE = 0xd000;
export const DEVICE_SPACE = 0x100;
export const IRQ_VECTOR = 0xfffe;

export function createCpuState(): CpuState {
  return {
    registers: { a: 0, x: 0, y: 0, sp: 0xff, pc: CODE_BASE },
    flags: FLAG_UNUSED | flagBit('I'),
    memory: new Uint8Array(MEMORY_SIZE),
    memoryVersion: 0,
    io: createIo(),
    ioVersion: 0
  };
}

/** Bit positions in P. B is not a flag: it exists only in the copy of P that BRK and PHP push. */
const FLAG_BITS = { C: 0, Z: 1, I: 2, D: 3, V: 6, N: 7 } as const;

export type FlagName = keyof typeof FLAG_BITS;

/** In the order the bits sit in P, high to low. */
export const FLAG_NAMES: readonly FlagName[] = ['N', 'V', 'D', 'I', 'Z', 'C'];

/** Bit 5 has no flag behind it and always reads as 1. */
export const FLAG_UNUSED = 0x20;
/** Bit 4 in a pushed copy of P: 1 when BRK or PHP pushed it, 0 for a hardware interrupt. */
export const FLAG_BREAK = 0x10;

export function flagBit(flag: FlagName): number {
  return 1 << FLAG_BITS[flag];
}

export function getFlag(state: Pick<CpuState, 'flags'>, flag: FlagName): boolean {
  return (state.flags & flagBit(flag)) !== 0;
}

export function setFlag(state: CpuState, flag: FlagName, on: boolean): void {
  state.flags = on ? state.flags | flagBit(flag) : state.flags & ~flagBit(flag);
}

/** N and Z, which nearly every instruction sets from the value it produced. */
export function setNZ(state: CpuState, value: number): void {
  setFlag(state, 'Z', (value & 0xff) === 0);
  setFlag(state, 'N', (value & 0x80) !== 0);
}

/** P as a status byte loaded from the stack: B is dropped and bit 5 reads 1. */
export function loadedFlags(byte: number): number {
  return (byte & ~FLAG_BREAK) | FLAG_UNUSED;
}
