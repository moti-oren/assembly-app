import { explainOffset, type OffsetBreakdown } from '@/core/x86/address';
import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { getSpec, isStringCompare, type Mnemonic } from '@/core/x86/instructions';
import { formatHex, littleEndian, truncate } from '@/core/shared/numbers';
import {
  effectiveOffset,
  formatOperand,
  memorySegment,
  operandSize,
  readOperandMemory,
  type Operand
} from '@/core/x86/operands';
import { isByteRegister, wordOf, type RegisterName, type WordRegister } from '@/core/x86/registers';
import { readRegister, readSegmented, type CpuState, type RegisterFile } from '@/core/x86/state';

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

/** SCAS and CMPS have no operands to read back; the ALU's own record has what they compared. */
function stringCompareEquation(record: ExecutionRecord): Equation | null {
  if (!isStringCompare(record.instruction.mnemonic) || record.alu?.kind !== 'subtract') {
    return null;
  }
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

export function describeEquation(state: CpuState, record: ExecutionRecord): Equation | null {
  const stringCompare = stringCompareEquation(record);
  if (stringCompare) return stringCompare;

  const { instruction, memoryWrites } = record;
  const { mnemonic } = instruction;
  const [destination, source] = instruction.operands;
  const operator = OPERATORS[mnemonic];
  if (!operator || !destination) return null;

  const size = operandSize(destination) ?? 16;
  // Memory operands resolve with the registers as they were when the instruction ran.
  const stateBefore = record.before;
  const read = (operand: Operand, registersFrom: RegisterFile): number => {
    if (operand.type === 'reg') return readRegister(registersFrom, operand.name);
    if (operand.type === 'mem') {
      return readOperandMemory(state, stateBefore, operand, size);
    }
    return operand.type === 'imm' ? truncate(operand.value, size) : 0;
  };

  const left =
    destination.type === 'mem' && memoryWrites.length > 0
      ? littleEndian(memoryWrites.map((write) => write.before))
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
  /** For a repeated string instruction, how many bytes it wrote, from this address on. */
  bytes?: number;
}

type DataSegment = MemoryAccess['segment'];

function memoryAccess(
  record: ExecutionRecord,
  segment: DataSegment,
  offset: number,
  value: string,
  write: boolean,
  offsetParts: OffsetBreakdown | null = null
): MemoryAccess {
  return {
    address: `${segment.toUpperCase()}:${formatHex(offset, 16)}`,
    value,
    write,
    segment,
    segmentValue: record.before.registers[segment],
    offset: truncate(offset, 16),
    offsetParts
  };
}

/** A string instruction: the last element a store or copy wrote, or the element it read. */
function stringAccess(state: CpuState, record: ExecutionRecord): MemoryAccess | null {
  const { instruction, memoryWrites } = record;
  const registers = record.before.registers;
  const size = getSpec(instruction.mnemonic).size ?? 8;
  // A store or copy shows the first element it wrote, at ES:DI; a repeated one, how many bytes.
  if (memoryWrites.length > 0) {
    const first = memoryWrites.slice(0, size / 8);
    const value = littleEndian(first.map((write) => write.after));
    const offset = first[0].address - (registers.es << 4);
    const access = memoryAccess(record, 'es', offset, formatHex(value, size), true);
    return memoryWrites.length > size / 8 ? { ...access, bytes: memoryWrites.length } : access;
  }
  // With CX = 0 a repeat touches no memory at all.
  if (instruction.prefix && registers.cx === 0) return null;
  const fromSource = decode(instruction).reads.includes('si');
  const segment = fromSource ? 'ds' : 'es';
  const offset = fromSource ? registers.si : registers.di;
  const value = readSegmented(state, registers[segment], offset, size);
  return memoryAccess(record, segment, offset, formatHex(value, size), false);
}

/** With no memory operand, anything written went onto the stack (PUSH, CALL); POP reads it. */
function stackAccess(state: CpuState, record: ExecutionRecord): MemoryAccess | null {
  const { instruction, memoryWrites } = record;
  const registers = record.before.registers;
  if (memoryWrites.length > 0) {
    // An interrupt pushes three words; the one on show is the last, now on top of the stack.
    const top = memoryWrites.slice(-2);
    const value = littleEndian(top.map((write) => write.after));
    const offset = top[0].address - (registers.ss << 4);
    return memoryAccess(record, 'ss', offset, formatHex(value, 16), true);
  }
  if (decode(instruction).stack === 'pop') {
    const value = formatHex(readSegmented(state, registers.ss, registers.sp, 16), 16);
    return memoryAccess(record, 'ss', registers.sp, value, false);
  }
  return null;
}

export function describeMemoryAccess(
  state: CpuState,
  record: ExecutionRecord
): MemoryAccess | null {
  const { instruction, memoryWrites } = record;
  const operand = instruction.operands.find((candidate) => candidate.type === 'mem');
  if (operand) {
    const stateBefore = record.before;
    const value = readOperandMemory(state, stateBefore, operand, operand.size);
    return memoryAccess(
      record,
      memorySegment(operand),
      effectiveOffset(stateBefore, operand),
      formatHex(value, operand.size),
      memoryWrites.length > 0,
      explainOffset(stateBefore, operand)
    );
  }
  if (getSpec(instruction.mnemonic).category === 'string') return stringAccess(state, record);
  return stackAccess(state, record);
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
    const value = littleEndian(portWrites.map((write) => write.after));
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
 * The registers an instruction wrote, as words: writing AL writes part of AX. They count as
 * written even when the value stayed the same, e.g. `xor ax, ax` on an AX that is already 0.
 */
export function registersWritten(record: ExecutionRecord): Set<WordRegister> {
  return new Set(record.registersWritten.map(wordOf));
}

/**
 * Whether the instruction wrote `name`: a word counts when either of its halves was written,
 * and a half counts when its whole word was.
 */
export function wasWritten(record: ExecutionRecord | null, name: RegisterName): boolean {
  if (!record) return false;
  const written = record.registersWritten;
  if (written.includes(name)) return true;
  if (isByteRegister(name)) return written.includes(wordOf(name));
  return written.some((other) => isByteRegister(other) && wordOf(other) === name);
}
