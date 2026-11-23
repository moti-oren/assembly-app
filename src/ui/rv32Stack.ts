import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction } from '@/core/rv32/instructions';
import { formatRegister } from '@/core/rv32/operands';
import { RA, SP } from '@/core/rv32/registers';
import { readRegister, STACK_TOP, type CpuState } from '@/core/rv32/state';
import { formatAddress } from './flatMemory';
import { RV32_ADDRESSES } from './rv32View';
import {
  cellsBetween,
  stackEntries,
  type CellText,
  type StackCell,
  type StackView
} from './stackView';
import type { StackWriters } from './stackWriters';

const WORD = 4;
/** A stack pointer further than this from the top of RAM is taken to point somewhere else. */
const DEEPEST = 0x10000;

/** The register a word was stored from, when a whole word was stored. */
function storedRegister(record: ExecutionRecord | null): number | null {
  if (record?.instruction.mnemonic !== 'sw') return null;
  const [source] = record.instruction.operands;
  return source.type === 'reg' ? source.index : null;
}

function labelOf(record: ExecutionRecord | null): string {
  if (!record) return 'not written yet';
  const register = storedRegister(record);
  if (register === null) return 'written in part';
  return register === RA ? 'ra, the return address' : formatRegister(register);
}

/** Whether `sp` points at a word of the stack, or at its empty top. */
function inStack(sp: number): boolean {
  return sp % WORD === 0 && sp <= STACK_TOP && STACK_TOP - sp <= DEEPEST;
}

/**
 * RISC-V's stack: the words from sp up to the top of RAM. No instruction pushes: a program makes
 * room by lowering sp, and stores into it.
 */
export function rv32Stack(
  state: CpuState,
  history: readonly ExecutionRecord[],
  writers: StackWriters
): StackView {
  const sp = readRegister(state, SP);
  const last = history.at(-1);
  const before = last ? readRegister(last.before, SP) : sp;
  const describe = (cell: StackCell, writer: ExecutionRecord | null): CellText => {
    const bytes = state.memory.subarray(cell.address, cell.address + WORD);
    const value = bytes.reduceRight((word, byte) => word * 0x100 + byte, 0);
    return {
      address: formatAddress(RV32_ADDRESSES, cell.address),
      value: formatAddress(RV32_ADDRESSES, value),
      label: labelOf(writer),
      returns: storedRegister(writer) === RA
    };
  };
  const valid = inStack(sp);
  const { entries, hidden } = stackEntries({
    live: valid ? cellsBetween(sp, STACK_TOP, WORD) : [],
    popped: valid && inStack(before) && before < sp ? cellsBetween(before, sp, WORD) : [],
    history,
    writers,
    format: formatInstruction,
    describe
  });
  return {
    pointer: `sp ${formatAddress(RV32_ADDRESSES, sp)}`,
    entries,
    hidden,
    empty: valid
      ? 'The stack is empty. No instruction pushes: a program lowers sp to make room (addi sp, sp, -16) and stores into it.'
      : 'sp does not point into the stack.'
  };
}
