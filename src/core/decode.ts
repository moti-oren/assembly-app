import {
  formatInstruction,
  getSpec,
  matchingForms,
  type Category,
  type Instruction,
  type Mnemonic
} from './instructions';
import type { Size } from './numbers';
import { formatOperand, memorySegment, operandSize, type OperandKind } from './operands';
import {
  BYTE_REGISTER_LOCATION,
  WORD_REGISTERS,
  isByteRegister,
  type RegisterName,
  type WordRegister
} from './registers';

/** The steps a CPU repeats for every instruction. */
export const CYCLE_PHASES = ['fetch', 'decode', 'execute'] as const;
export type CyclePhase = (typeof CYCLE_PHASES)[number];

export const OPERAND_KIND_LABELS: Record<OperandKind, string> = {
  r8: '8-bit register',
  r16: '16-bit register',
  sreg: 'segment register',
  sregw: 'segment register',
  cl: 'shift count in CL',
  one: 'shift count of 1',
  imm8: '8-bit immediate',
  imm16: '16-bit immediate',
  m8: 'byte in memory',
  m16: 'word in memory',
  label: 'program line'
};

/** What an operand is to its instruction. `operand` is one that is neither: CMP, TEST, XCHG. */
export type OperandRole = 'destination' | 'source' | 'count' | 'target' | 'operand';

export interface DecodedOperand {
  text: string;
  kind: OperandKind;
  role: OperandRole;
}

/** What the control unit learns from an instruction before running it. */
export interface Decoded {
  mnemonic: Mnemonic;
  category: Category;
  description: string;
  /** Operand size in bits; null when no operand has a size (jumps, flag control). */
  size: Size | null;
  operands: DecodedOperand[];
  /** Registers the instruction reads and writes, including the ones it uses without naming. */
  reads: WordRegister[];
  writes: WordRegister[];
  memory: { read: boolean; write: boolean };
  readsFlags: boolean;
  writesFlags: boolean;
  usesAlu: boolean;
}

/** Instructions that overwrite their first operand without reading it. */
const OVERWRITES_FIRST = new Set<Mnemonic>(['mov', 'pop']);

/** Instructions that only read their first operand. */
const KEEPS_FIRST = new Set<Mnemonic>(['cmp', 'test', 'push', 'mul', 'imul', 'div', 'idiv']);

const STACK = { reads: ['sp', 'ss'], writes: ['sp'] } as const;
const COUNTED_JUMP = { reads: ['cx'], writes: ['cx', 'ip'] } as const;

/** Registers used without being written in the instruction. MUL and DIV depend on the size. */
const IMPLICIT: Partial<
  Record<Mnemonic, { reads: readonly WordRegister[]; writes: readonly WordRegister[] }>
> = {
  push: STACK,
  pop: STACK,
  call: { reads: ['sp', 'ss', 'ip'], writes: ['sp', 'ip'] },
  ret: { reads: ['sp', 'ss'], writes: ['sp', 'ip'] },
  loop: COUNTED_JUMP,
  loope: COUNTED_JUMP,
  loopne: COUNTED_JUMP,
  jcxz: { reads: ['cx'], writes: ['ip'] }
};

const READS_FLAGS = new Set<Mnemonic>(['adc', 'sbb', 'rcl', 'rcr', 'cmc', 'loope', 'loopne']);
const JUMPS_WITHOUT_FLAGS = new Set<Mnemonic>(['jmp', 'jcxz', 'loop', 'call', 'ret']);
const KEEPS_FLAGS = new Set<Mnemonic>(['not', 'div', 'idiv', 'nop']);

function roles(mnemonic: Mnemonic, category: Category, count: number): OperandRole[] {
  if (category === 'control') return ['target'];
  if (category === 'shift') return ['destination', 'count'];
  if (mnemonic === 'cmp' || mnemonic === 'test' || mnemonic === 'xchg') {
    return ['operand', 'operand'];
  }
  if (count === 2) return ['destination', 'source'];
  return [KEEPS_FIRST.has(mnemonic) ? 'source' : 'destination'];
}

function parent(name: RegisterName): WordRegister {
  return isByteRegister(name) ? BYTE_REGISTER_LOCATION[name].parent : name;
}

export function decode(instruction: Instruction): Decoded {
  const { mnemonic, operands } = instruction;
  const form = matchingForms(mnemonic, operands).find((kinds) => kinds.length === operands.length);
  if (!form) {
    throw new Error(`Cannot decode an incomplete instruction: ${formatInstruction(instruction)}`);
  }

  const { category, description } = getSpec(mnemonic);
  const size = operands.map(operandSize).find((found) => found !== null) ?? null;
  const operandRoles = roles(mnemonic, category, operands.length);

  const reads = new Set<WordRegister>();
  const writes = new Set<WordRegister>();
  const memory = { read: false, write: false };

  operands.forEach((operand, index) => {
    const first = index === 0;
    const isRead = !(first && OVERWRITES_FIRST.has(mnemonic));
    const isWritten = mnemonic === 'xchg' || (first && !KEEPS_FIRST.has(mnemonic));
    if (operand.type === 'reg') {
      if (isRead) reads.add(parent(operand.name));
      if (isWritten) writes.add(parent(operand.name));
    } else if (operand.type === 'mem') {
      // Forming the address reads its registers, whichever way the data then moves.
      reads.add(memorySegment(operand));
      if (operand.base) reads.add(operand.base);
      memory.read ||= isRead;
      memory.write ||= isWritten;
    }
  });

  const implicit = IMPLICIT[mnemonic];
  implicit?.reads.forEach((name) => reads.add(name));
  implicit?.writes.forEach((name) => writes.add(name));
  if (category === 'control' && !implicit) writes.add('ip');
  if (mnemonic === 'push' || mnemonic === 'call') memory.write = true;
  if (mnemonic === 'pop' || mnemonic === 'ret') memory.read = true;

  if (mnemonic === 'mul' || mnemonic === 'imul' || mnemonic === 'div' || mnemonic === 'idiv') {
    // 8-bit: everything stays inside AX. 16-bit: DX holds the upper half or the remainder.
    reads.add('ax');
    writes.add('ax');
    if (size === 16) {
      writes.add('dx');
      if (mnemonic === 'div' || mnemonic === 'idiv') reads.add('dx');
    }
  }

  const inOrder = (names: Set<WordRegister>) => WORD_REGISTERS.filter((name) => names.has(name));
  const usesAlu = category === 'arithmetic' || category === 'logic' || category === 'shift';

  return {
    mnemonic,
    category,
    description,
    size,
    operands: operands.map((operand, index) => ({
      text: formatOperand(operand),
      kind: form[index],
      role: operandRoles[index]
    })),
    reads: inOrder(reads),
    writes: inOrder(writes),
    memory,
    readsFlags:
      READS_FLAGS.has(mnemonic) || (category === 'control' && !JUMPS_WITHOUT_FLAGS.has(mnemonic)),
    writesFlags: (usesAlu || category === 'flags') && !KEEPS_FLAGS.has(mnemonic),
    usesAlu
  };
}
