import { formatHex } from '@/core/shared/numbers';
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
