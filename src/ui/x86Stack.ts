import { formatHex } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction } from '@/core/x86/instructions';
import { physicalAddress, type CpuState } from '@/core/x86/state';
import {
  cellsBetween,
  stackEntries,
  type CellText,
  type StackCell,
  type StackView
} from './stackView';
import type { StackWriters } from './stackWriters';

/** Where SP starts: the stack is empty there, and grows down from it a word at a time. */
export const X86_STACK_BASE = 0xfffe;
const WORD = 2;

/** The words an instruction pushed, the first one pushed first: their physical addresses. */
function pushedWords(record: ExecutionRecord): number[] {
  const low = record.memoryWrites
    .map((write) => write.address)
    .filter((_, index) => index % 2 === 0);
  return [...new Set(low)].sort((a, b) => b - a);
}

/** What a word on the stack is, from the instruction that put it there. */
function labelOf(record: ExecutionRecord | null, address: number, value: number): string {
  if (!record) return 'not written by an instruction';
  const { mnemonic } = record.instruction;
  if (record.interrupt !== null) {
    // An interrupt pushes FLAGS, then CS, then the line to come back to.
    const place = pushedWords(record).indexOf(address);
    return ['FLAGS', 'CS', `return to ${formatLabel(value)}`][place] ?? 'written';
  }
  if (mnemonic === 'call') return `return to ${formatLabel(value)}`;
  if (mnemonic === 'pushf') return 'FLAGS';
  if (mnemonic === 'push') return formatInstruction(record.instruction).replace(/^push\s+/, '');
  return 'written';
}

/** The 8086's stack: words from SS:SP up to where SP started. */
export function x86Stack(
  state: CpuState,
  history: readonly ExecutionRecord[],
  writers: StackWriters
): StackView {
  const { ss, sp } = state.registers;
  const base = physicalAddress(ss, 0);
  const last = history.at(-1);
  const before = last?.before.registers.sp ?? sp;
  const describe = (cell: StackCell, writer: ExecutionRecord | null): CellText => {
    const value = state.memory[cell.address] | (state.memory[cell.address + 1] << 8);
    const label = labelOf(writer, cell.address, value);
    return {
      address: formatHex(cell.address - base, 16),
      value: `${formatHex(value, 16)}h`,
      label,
      returns: label.startsWith('return to')
    };
  };
  const { entries, hidden } = stackEntries({
    live: sp <= X86_STACK_BASE ? cellsBetween(base + sp, base + X86_STACK_BASE, WORD) : [],
    popped: before < sp ? cellsBetween(base + before, base + sp, WORD) : [],
    history,
    writers,
    format: formatInstruction,
    describe
  });
  return {
    pointer: `SS:SP ${formatHex(ss, 16)}:${formatHex(sp, 16)}`,
    entries,
    hidden,
    empty: 'The stack is empty. PUSH and CALL put a word on it, and move SP down by 2.'
  };
}
