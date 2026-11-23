import { formatInstruction } from '@/core/mos6502/instructions';
import { formatHex } from '@/core/shared/numbers';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { STACK_PAGE, type CpuState } from '@/core/mos6502/state';
import { formatAddress } from './flatMemory';
import { MOS6502_ADDRESSES } from './mos6502View';
import { stackEntries, type CellText, type StackCell, type StackView } from './stackView';
import { writerOf, type StackWriters } from './stackWriters';

/** Where SP starts: the stack is empty there, and grows down from $01FF a byte at a time. */
export const MOS6502_STACK_BASE = 0xff;

/** The lowest address an instruction wrote. */
function lowest(record: ExecutionRecord): number {
  return Math.min(...record.memoryWrites.map((write) => write.address));
}

/**
 * Whether the byte at `address` is the low half of an address an instruction pushed: JSR pushes
 * only an address, and BRK pushes P below one.
 */
function startsAddress(record: ExecutionRecord | null, address: number): boolean {
  if (!record) return false;
  const { mnemonic } = record.instruction;
  if (mnemonic === 'jsr') return address === lowest(record);
  return mnemonic === 'brk' && address === lowest(record) + 1;
}

/** The bytes from `from` up to `to`, with the two halves of a pushed address as one cell. */
function cells(
  from: number,
  to: number,
  history: readonly ExecutionRecord[],
  writers: StackWriters
): StackCell[] {
  const found: StackCell[] = [];
  for (let address = from; address < to;) {
    const step = writerOf(writers, address, 1);
    const pair = address + 1 < to && startsAddress(step === null ? null : history[step], address);
    found.push({ address, size: pair ? 2 : 1 });
    address += pair ? 2 : 1;
  }
  return found;
}

function labelOf(record: ExecutionRecord | null, cell: StackCell, value: number): string {
  if (!record) return 'not written by an instruction';
  const { mnemonic } = record.instruction;
  // JSR keeps the address of its own last byte, and RTS adds the 1.
  if (cell.size === 2 && mnemonic === 'jsr')
    return `return to $${formatHex(value + 1, 16)}, kept less 1`;
  if (cell.size === 2) return `return to $${formatHex(value, 16)}`;
  if (mnemonic === 'pha') return 'A';
  if (mnemonic === 'php' || mnemonic === 'brk') return 'P, the flags';
  return 'written';
}

/** The 6502's stack: the bytes of page $01 above SP. */
export function mos6502Stack(
  state: CpuState,
  history: readonly ExecutionRecord[],
  writers: StackWriters
): StackView {
  const { sp } = state.registers;
  const top = STACK_PAGE + sp + 1;
  const before = history.at(-1)?.before.registers.sp ?? sp;
  const describe = (cell: StackCell, writer: ExecutionRecord | null): CellText => {
    const low = state.memory[cell.address];
    const value = cell.size === 2 ? low | (state.memory[cell.address + 1] << 8) : low;
    return {
      address: formatAddress(MOS6502_ADDRESSES, cell.address),
      value: `$${formatHex(value, cell.size === 2 ? 16 : 8)}`,
      label: labelOf(writer, cell, value),
      returns: cell.size === 2
    };
  };
  const { entries, hidden } = stackEntries({
    live: cells(top, STACK_PAGE + MOS6502_STACK_BASE + 1, history, writers),
    popped: before < sp ? cells(STACK_PAGE + before + 1, top, history, writers) : [],
    history,
    writers,
    format: formatInstruction,
    describe
  });
  return {
    pointer: `SP $${formatHex(sp, 8)}`,
    entries,
    hidden,
    empty: 'The stack is empty. PHA, PHP and JSR put bytes on it, in page $01, and move SP down.'
  };
}
