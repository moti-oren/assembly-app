import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { STACK_PAGE } from '@/core/mos6502/state';
import { formatHex } from '@/core/shared/numbers';
import { describeAccess } from './mos6502Explain';

/** What the memory panel's line says of the last instruction: where it went, and in words. */
export interface ShownAccess {
  address: number;
  size: number;
  text: string;
}

/** How many bytes each instruction that pulls takes off the stack. */
const PULLS: Partial<Record<string, number>> = { pla: 1, plp: 1, rts: 2, rti: 3 };

/** Stack bytes in words: `$41 at $01FF`, or `2 bytes at $01FE–$01FF`. */
function bytesAt(address: number, size: number, value: number): string {
  const first = `$${formatHex(address, 16)}`;
  return size === 1
    ? `$${formatHex(value, 8)} at ${first}`
    : `${size} bytes at ${first}–$${formatHex(address + size - 1, 16)}`;
}

/** The stack bytes an instruction pushed or pulled; its record keeps none as its access. */
function stackAccess(record: ExecutionRecord, memory: Uint8Array): ShownAccess | null {
  const pulls = PULLS[record.instruction.mnemonic];
  if (pulls) {
    const address = STACK_PAGE + ((record.before.registers.sp + 1) & 0xff);
    return { address, size: pulls, text: `Pulled ${bytesAt(address, pulls, memory[address])}` };
  }
  const writes = record.memoryWrites.filter((write) => write.address >> 8 === STACK_PAGE >> 8);
  if (writes.length === 0) return null;
  const lowest = writes.reduce((low, write) => (write.address < low.address ? write : low));
  const text = `Pushed ${bytesAt(lowest.address, writes.length, lowest.after)}`;
  return { address: lowest.address, size: writes.length, text };
}

/**
 * The memory the last instruction used, for the memory panel: the load or store its record
 * keeps, or else what it pushed or pulled. `memory` is the CPU's after the instruction.
 */
export function memoryAccessOf(record: ExecutionRecord, memory: Uint8Array): ShownAccess | null {
  const text = describeAccess(record);
  if (record.access) return text ? { address: record.access.address, size: 1, text } : null;
  return stackAccess(record, memory);
}
