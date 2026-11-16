import { explainOffset, type OffsetBreakdown } from '@/core/address';
import type { ExecutionRecord } from '@/core/execute';
import { getSpec, type Category, type Mnemonic } from '@/core/instructions';
import { formatHex, truncate, type Size } from '@/core/numbers';
import {
  effectiveAddress,
  effectiveOffset,
  formatOperand,
  memorySegment,
  operandSize,
  type Operand
} from '@/core/operands';
import { BYTE_REGISTER_LOCATION, isByteRegister, type WordRegister } from '@/core/registers';
import { physicalAddress, readMemory, readRegister, type CpuState } from '@/core/state';

/** Instructions whose result can be shown as `a <operator> b = result`. */
const OPERATORS: Partial<Record<Mnemonic, string>> = {
  add: '+',
  adc: '+',
  inc: '+',
  sub: '−',
  sbb: '−',
  cmp: '−',
  dec: '−',
  and: 'AND',
  test: 'AND',
  or: 'OR',
  xor: 'XOR'
};

/**
 * Whether the instruction went through the ALU, and whether a result came back out of it.
 * Decided by the instruction's kind, not by whether the ALU panel can show it as a sum:
 * NEG, MUL or a shift use the ALU just as much as ADD does. CMP and TEST keep only the flags.
 */
export function aluUse(record: ExecutionRecord): { input: boolean; output: boolean } {
  const { mnemonic } = record.instruction;
  const input = ALU_CATEGORIES.has(getSpec(mnemonic).category);
  return { input, output: input && mnemonic !== 'cmp' && mnemonic !== 'test' };
}

const ALU_CATEGORIES = new Set<Category>(['arithmetic', 'logic', 'shift']);

/** Instructions that overwrite their first operand without reading it. */
const OVERWRITES_FIRST_OPERAND = new Set<Mnemonic>(['mov', 'pop']);

/** Instructions that only read their first operand. */
const KEEPS_FIRST_OPERAND = new Set<Mnemonic>(['cmp', 'test', 'push']);

/** The CPU with its registers as they were when `record` ran; memory operands resolve there. */
function before(state: CpuState, record: ExecutionRecord): CpuState {
  return { ...state, registers: record.before.registers } as CpuState;
}

export interface Equation {
  destination: string;
  left: string;
  operator: string;
  right: string;
  /** CF going in, for ADC and SBB. */
  carry: number | null;
  result: string;
  /** CMP and TEST compute a result only to set the flags, then throw it away. */
  discarded: boolean;
}

export function describeEquation(state: CpuState, record: ExecutionRecord): Equation | null {
  const { instruction, memoryWrites } = record;
  const { mnemonic } = instruction;
  const [destination, source] = instruction.operands;
  const operator = OPERATORS[mnemonic];
  if (!operator || !destination) return null;

  const size = operandSize(destination) ?? 16;
  const stateBefore = before(state, record);
  const read = (operand: Operand, registersFrom: CpuState): number => {
    if (operand.type === 'reg') return readRegister(registersFrom, operand.name);
    if (operand.type === 'mem') {
      return readMemory(state, effectiveAddress(stateBefore, operand), size);
    }
    return operand.type === 'imm' ? truncate(operand.value, size) : 0;
  };

  const left =
    destination.type === 'mem' && memoryWrites.length > 0
      ? memoryWrites.reduce((value, write, i) => value | (write.before << (8 * i)), 0)
      : read(destination, stateBefore);
  const right = source ? read(source, stateBefore) : 1;
  const discarded = mnemonic === 'cmp' || mnemonic === 'test';
  const result = !discarded
    ? read(destination, state)
    : mnemonic === 'cmp'
      ? left - right
      : left & right;

  return {
    destination: formatOperand(destination),
    left: formatHex(left, size),
    operator,
    right: formatHex(right, size),
    carry: mnemonic === 'adc' || mnemonic === 'sbb' ? record.before.flags & 1 : null,
    result: formatHex(result, size),
    discarded
  };
}

export interface MemoryAccess {
  /** `segment:offset`, e.g. `SS:FFFC`. */
  address: string;
  value: string;
  write: boolean;
  /** The segment register the access went through, as it was when the instruction ran. */
  segment: 'ds' | 'ss';
  segmentValue: number;
  offset: number;
  /** How a memory operand formed its offset; null for the stack, where the offset is SP. */
  offsetParts: OffsetBreakdown | null;
}

export function describeMemoryAccess(
  state: CpuState,
  record: ExecutionRecord
): MemoryAccess | null {
  const { instruction, memoryWrites } = record;
  const registers = record.before.registers;
  const access = (
    segment: 'ds' | 'ss',
    offset: number,
    value: string,
    write: boolean,
    offsetParts: OffsetBreakdown | null = null
  ): MemoryAccess => ({
    address: `${segment.toUpperCase()}:${formatHex(offset, 16)}`,
    value,
    write,
    segment,
    segmentValue: registers[segment],
    offset: truncate(offset, 16),
    offsetParts
  });

  const operand = instruction.operands.find((candidate) => candidate.type === 'mem');
  if (operand) {
    const stateBefore = before(state, record);
    const value = readMemory(state, effectiveAddress(stateBefore, operand), operand.size);
    return access(
      memorySegment(operand),
      effectiveOffset(stateBefore, operand),
      formatHex(value, operand.size),
      memoryWrites.length > 0,
      explainOffset(stateBefore, operand)
    );
  }
  // No memory operand, so anything written went onto the stack (PUSH, CALL).
  if (memoryWrites.length > 0) {
    const value = memoryWrites.reduce((sum, write, i) => sum | (write.after << (8 * i)), 0);
    return access(
      'ss',
      memoryWrites[0].address - (registers.ss << 4),
      formatHex(value, (memoryWrites.length * 8) as Size),
      true
    );
  }
  if (instruction.mnemonic === 'pop' || instruction.mnemonic === 'ret') {
    const top = physicalAddress(registers.ss, registers.sp);
    return access('ss', registers.sp, formatHex(readMemory(state, top, 16), 16), false);
  }
  return null;
}

/** The registers an instruction's operands read: sources, and the parts of a memory address. */
export function registersRead(record: ExecutionRecord): Set<WordRegister> {
  const read = new Set<WordRegister>();
  record.instruction.operands.forEach((operand, index) => {
    if (operand.type === 'reg') {
      if (index === 0 && OVERWRITES_FIRST_OPERAND.has(record.instruction.mnemonic)) return;
      const { name } = operand;
      read.add(isByteRegister(name) ? BYTE_REGISTER_LOCATION[name].parent : name);
    } else if (operand.type === 'mem') {
      read.add(memorySegment(operand));
      if (operand.base) read.add(operand.base);
    }
  });
  return read;
}

/**
 * The registers an instruction names as a destination. They count as written even when the
 * value happens to stay the same, e.g. `xor ax, ax` on an AX that is already 0.
 */
export function registersWritten(record: ExecutionRecord): Set<WordRegister> {
  const written = new Set<WordRegister>();
  const { mnemonic, operands } = record.instruction;
  const add = (operand: Operand | undefined): void => {
    if (operand?.type !== 'reg') return;
    const { name } = operand;
    written.add(isByteRegister(name) ? BYTE_REGISTER_LOCATION[name].parent : name);
  };
  if (!KEEPS_FIRST_OPERAND.has(mnemonic)) add(operands[0]);
  if (mnemonic === 'xchg') add(operands[1]);
  return written;
}
