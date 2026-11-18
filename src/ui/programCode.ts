import { formatHex } from '@/core/shared/numbers';
import { formatHex32 } from '@/core/rv32/bits';
import type { AssembledLine as Rv32Line } from '@/core/rv32/encode';
import type { AssembledLine as X86Line } from '@/core/x86/encode';

/** The machine code shown beside one program line. */
export interface LineCode {
  /** Where the line starts: a byte offset in the code, or an address in memory. */
  address: number;
  bytes: readonly number[];
  /** Set when the line cannot be encoded as written. */
  problem: string | null;
}

/** How the program panel names where a line's code sits. */
export type CodePlace = (address: number) => string;

export function x86LineCode(line: X86Line): LineCode {
  return { address: line.offset, bytes: line.encoding.bytes, problem: line.encoding.problem };
}

export const X86_CODE_PLACE: CodePlace = (offset) => `offset ${formatHex(offset, 16)}h`;

export function rv32LineCode(line: Rv32Line): LineCode {
  return { address: line.address, bytes: line.encoding.bytes, problem: line.encoding.problem };
}

export const RV32_CODE_PLACE: CodePlace = (address) => `address 0x${formatHex32(address)}`;
