import { explainOffset, type OffsetBreakdown } from '@/core/address';
import { decode } from '@/core/decode';
import type { ExecutionRecord } from '@/core/execute';
import { getSpec, isStringCompare, type Mnemonic } from '@/core/instructions';
import { formatHex, truncate } from '@/core/numbers';
import {
  effectiveAddress,
  effectiveOffset,
  formatOperand,
  memorySegment,
  operandSize,
  type Operand
} from '@/core/operands';
import type { WordRegister } from '@/core/registers';
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

/** Instructions that compute a result only to set the flags, then throw it away. */
function discardsResult(mnemonic: Mnemonic): boolean {
  return mnemonic === 'cmp' || mnemonic === 'test' || isStringCompare(mnemonic);
}

/**
 * Whether the instruction went through the ALU, and whether a result came back out of it.
 * Decided by the instruction's kind, not by whether the ALU panel can show it as a sum:
 * NEG, MUL or a shift use the ALU just as much as ADD does.
 */
export function aluUse(record: ExecutionRecord): { input: boolean; output: boolean } {
  const input = decode(record.instruction).usesAlu;
  return { input, output: input && !discardsResult(record.instruction.mnemonic) };
}

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

  // SCAS and CMPS have no operands to read back; the ALU's own record has what they compared.
  if (isStringCompare(mnemonic) && record.alu?.kind === 'subtract') {
    const { a, b, result, size } = record.alu;
    return {
      destination: '',
      left: formatHex(a, size),
      operator: '−',
      right: formatHex(b, size),
      carry: null,
      result: formatHex(result, size),
      discarded: true
    };
  }

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
  segment: 'ds' | 'es' | 'ss';
  segmentValue: number;
  offset: number;
  /** How a memory operand formed its offset; null when a register alone is the offset. */
  offsetParts: OffsetBreakdown | null;
}

export function describeMemoryAccess(
  state: CpuState,
  record: ExecutionRecord
): MemoryAccess | null {
  const { instruction, memoryWrites } = record;
  const registers = record.before.registers;
  const access = (
    segment: 'ds' | 'es' | 'ss',
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
  if (getSpec(instruction.mnemonic).category === 'string') {
    const size = getSpec(instruction.mnemonic).size ?? 8;
    // A repeated store or copy shows the last element it wrote, at ES:DI.
    if (memoryWrites.length > 0) {
      const last = memoryWrites.slice(-size / 8);
      const value = last.reduce((sum, write, i) => sum | (write.after << (8 * i)), 0);
      return access('es', last[0].address - (registers.es << 4), formatHex(value, size), true);
    }
    // With CX = 0 a repeat touches no memory at all.
    if (instruction.prefix && registers.cx === 0) return null;
    const fromSource = decode(instruction).reads.includes('si');
    const segment = fromSource ? 'ds' : 'es';
    const offset = fromSource ? registers.si : registers.di;
    const value = readMemory(state, physicalAddress(registers[segment], offset), size);
    return access(segment, offset, formatHex(value, size), false);
  }
  // No memory operand, so anything written went onto the stack (PUSH, CALL).
  if (memoryWrites.length > 0) {
    // An interrupt pushes three words; the one on show is the last, now on top of the stack.
    const top = memoryWrites.slice(-2);
    const value = top.reduce((sum, write, i) => sum | (write.after << (8 * i)), 0);
    return access('ss', top[0].address - (registers.ss << 4), formatHex(value, 16), true);
  }
  if (decode(instruction).stack === 'pop') {
    const top = physicalAddress(registers.ss, registers.sp);
    return access('ss', registers.sp, formatHex(readMemory(state, top, 16), 16), false);
  }
  return null;
}

export interface PortAccess {
  /** The port number in hex, e.g. `10` or `03F8`. */
  port: string;
  value: string;
  write: boolean;
}

/** The I/O port an IN or OUT went through, and the byte or word that crossed the bus. */
export function describePortAccess(state: CpuState, record: ExecutionRecord): PortAccess | null {
  const { instruction, portWrites } = record;
  const name = (port: number): string => formatHex(port, port > 0xff ? 16 : 8);
  if (instruction.mnemonic === 'out' && portWrites.length > 0) {
    const value = portWrites.reduce((sum, write, i) => sum | (write.after << (8 * i)), 0);
    const size = portWrites.length === 2 ? 16 : 8;
    return { port: name(portWrites[0].port), value: formatHex(value, size), write: true };
  }
  if (instruction.mnemonic === 'in') {
    const [destination, source] = instruction.operands;
    if (destination?.type !== 'reg' || !source) return null;
    const port = source.type === 'imm' ? source.value & 0xff : record.before.registers.dx;
    const size = operandSize(destination) ?? 8;
    return {
      port: name(port),
      value: formatHex(readRegister(state, destination.name), size),
      write: false
    };
  }
  return null;
}

/**
 * The registers an instruction read: its sources, the parts of a memory address, and the ones
 * it uses without naming (SP for PUSH, SI and DI for the string instructions).
 */
export function registersRead(record: ExecutionRecord): Set<WordRegister> {
  return new Set(decode(record.instruction).reads);
}

/**
 * The registers an instruction writes. They count as written even when the value happens to
 * stay the same, e.g. `xor ax, ax` on an AX that is already 0.
 */
export function registersWritten(record: ExecutionRecord): Set<WordRegister> {
  return new Set(decode(record.instruction).writes);
}
