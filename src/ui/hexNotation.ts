import type { ArchitectureId } from './architectures';

/** How a hex number is written from its digits: `2Ah`, `0x2A` or `$2A`. */
export type HexStyle = (digits: string) => string;

/** C's way, and RISC-V's: `0x2A`. */
export const PREFIXED: HexStyle = (digits) => `0x${digits}`;

/** Each CPU's own way, as its program and its panels write a number. */
export const HEX_STYLES: Record<ArchitectureId, HexStyle> = {
  // A first digit that is a letter gets a 0 in front, so `0FFh` cannot be read as a name.
  x86: (digits) => `${/^[A-F]/.test(digits) ? '0' : ''}${digits}h`,
  rv32: PREFIXED,
  mos6502: (digits) => `$${digits}`
};
