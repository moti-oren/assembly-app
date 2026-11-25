import {
  formatInstruction,
  REPEAT_PREFIXES,
  getSpec,
  instructionSize,
  isStringCompare,
  matchingForms,
  type Category,
  type Instruction,
  type Mnemonic
} from './instructions';
import type { Size } from '../shared/numbers';
import { formatOperandOf, memorySegment, type OperandKind } from './operands';
import { WORD_REGISTERS, wordOf, type WordRegister } from './registers';

export const OPERAND_KIND_LABELS: Record<OperandKind, string> = {
  r8: '8-bit register',
  r16: '16-bit register',
  sreg: 'segment register',
  sregw: 'segment register',
  cl: 'shift count in CL',
  al: '8-bit data register',
  ax: '16-bit data register',
  dx: 'port number in DX',
  one: 'shift count of 1',
  imm8: '8-bit immediate',
  imm16: '16-bit immediate',
  m8: 'byte in memory',
  m16: 'word in memory',
  label: 'program line'
};

/** What an operand is to its instruction. `operand` is one that is neither: CMP, TEST, XCHG. */
export type OperandRole = 'destination' | 'source' | 'count' | 'target' | 'vector' | 'operand';

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
  /** Whether it reads or writes an I/O port (IN, OUT). */
  port: 'read' | 'write' | null;
  /** Whether it pushes words below SS:SP or pops them from there. */
  stack: 'push' | 'pop' | null;
  readsFlags: boolean;
  writesFlags: boolean;
  usesAlu: boolean;
}

/** Instructions that overwrite their first operand without reading it. */
const OVERWRITES_FIRST = new Set<Mnemonic>(['mov', 'pop', 'in']);

/** Instructions that only read their first operand. */
const KEEPS_FIRST = new Set<Mnemonic>(['cmp', 'test', 'push', 'mul', 'imul', 'div', 'idiv', 'out']);

const STACK = { reads: ['sp', 'ss'], writes: ['sp'] } as const;
/** Entering an interrupt saves CS:IP on the stack and replaces them from the vector. */
const INTERRUPT_ENTRY = { reads: ['sp', 'cs', 'ss', 'ip'], writes: ['sp', 'cs', 'ip'] } as const;
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
  jcxz: { reads: ['cx'], writes: ['ip'] },
  int: INTERRUPT_ENTRY,
  into: INTERRUPT_ENTRY,
  iret: { reads: ['sp', 'ss'], writes: ['sp', 'cs', 'ip'] },
  pushf: STACK,
  popf: STACK,
  movsb: { reads: ['si', 'di', 'ds', 'es'], writes: ['si', 'di'] },
  movsw: { reads: ['si', 'di', 'ds', 'es'], writes: ['si', 'di'] },
  stosb: { reads: ['ax', 'di', 'es'], writes: ['di'] },
  stosw: { reads: ['ax', 'di', 'es'], writes: ['di'] },
  lodsb: { reads: ['si', 'ds'], writes: ['ax', 'si'] },
  lodsw: { reads: ['si', 'ds'], writes: ['ax', 'si'] },
  scasb: { reads: ['ax', 'di', 'es'], writes: ['di'] },
  scasw: { reads: ['ax', 'di', 'es'], writes: ['di'] },
  cmpsb: { reads: ['si', 'di', 'ds', 'es'], writes: ['si', 'di'] },
  cmpsw: { reads: ['si', 'di', 'ds', 'es'], writes: ['si', 'di'] }
};

const STRING_READS_MEMORY = new Set<Mnemonic>([
  'movsb',
  'movsw',
  'lodsb',
  'lodsw',
  'scasb',
  'scasw',
  'cmpsb',
  'cmpsw'
]);
const STRING_WRITES_MEMORY = new Set<Mnemonic>(['movsb', 'movsw', 'stosb', 'stosw']);

const STACK_WRITERS = new Set<Mnemonic>(['push', 'call', 'int', 'into', 'pushf']);
const STACK_READERS = new Set<Mnemonic>(['pop', 'ret', 'iret', 'popf']);

const READS_FLAGS = new Set<Mnemonic>([
  'adc',
  'sbb',
  'rcl',
  'rcr',
  'cmc',
  'loope',
  'loopne',
  'int',
  'into',
  'pushf'
]);
/** Outside the ALU and the flag-control group, these still change FLAGS. */
const WRITES_FLAGS = new Set<Mnemonic>(['int', 'into', 'iret']);
const JUMPS_WITHOUT_FLAGS = new Set<Mnemonic>(['jmp', 'jcxz', 'loop', 'call', 'ret']);
const KEEPS_FLAGS = new Set<Mnemonic>(['not', 'div', 'idiv', 'nop', 'pushf']);

function roles(mnemonic: Mnemonic, category: Category, count: number): OperandRole[] {
  if (category === 'control') return ['target'];
  if (mnemonic === 'int') return ['vector'];
  if (category === 'shift') return ['destination', 'count'];
  if (mnemonic === 'cmp' || mnemonic === 'test' || mnemonic === 'xchg') {
    return ['operand', 'operand'];
  }
  if (count === 2) return ['destination', 'source'];
  return [KEEPS_FIRST.has(mnemonic) ? 'source' : 'destination'];
}

/** The registers and memory one instruction uses, filled in step by step. */
interface Usage {
  reads: Set<WordRegister>;
  writes: Set<WordRegister>;
  memory: { read: boolean; write: boolean };
}

/** What the instruction's own operands read and write. */
function explicitUse({ mnemonic, operands }: Instruction): Usage {
  const usage: Usage = {
    reads: new Set(),
    writes: new Set(),
    memory: { read: false, write: false }
  };
  operands.forEach((operand, index) => {
    const first = index === 0;
    const isRead = !(first && OVERWRITES_FIRST.has(mnemonic));
    const isWritten = mnemonic === 'xchg' || (first && !KEEPS_FIRST.has(mnemonic));
    if (operand.type === 'reg') {
      if (isRead) usage.reads.add(wordOf(operand.name));
      if (isWritten) usage.writes.add(wordOf(operand.name));
    } else if (operand.type === 'mem') {
      // Forming the address reads its registers, whichever way the data then moves.
      usage.reads.add(memorySegment(operand));
      if (operand.base) usage.reads.add(operand.base);
      usage.memory.read ||= isRead;
      usage.memory.write ||= isWritten;
    }
  });
  return usage;
}

/** Adds what the instruction uses without naming it: the stack, CX, the vector table, AX and DX. */
function addImplicitUse(
  { reads, writes, memory }: Usage,
  { prefix, mnemonic }: Instruction,
  category: Category,
  size: Size | null
): void {
  const implicit = IMPLICIT[mnemonic];
  implicit?.reads.forEach((name) => reads.add(name));
  implicit?.writes.forEach((name) => writes.add(name));
  if (category === 'control' && !implicit) writes.add('ip');
  if (STACK_WRITERS.has(mnemonic)) memory.write = true;
  if (STACK_READERS.has(mnemonic)) memory.read = true;
  // The handler's address is read out of the vector table.
  if (mnemonic === 'int' || mnemonic === 'into') memory.read = true;
  if (STRING_READS_MEMORY.has(mnemonic)) memory.read = true;
  if (STRING_WRITES_MEMORY.has(mnemonic)) memory.write = true;
  if (prefix) {
    reads.add('cx');
    writes.add('cx');
  }

  if (mnemonic === 'mul' || mnemonic === 'imul' || mnemonic === 'div' || mnemonic === 'idiv') {
    // 8-bit: everything stays inside AX. 16-bit: DX holds the upper half or the remainder.
    reads.add('ax');
    writes.add('ax');
    if (size === 16) {
      writes.add('dx');
      if (mnemonic === 'div' || mnemonic === 'idiv') reads.add('dx');
    }
  }
}

/** Whether the instruction reads and writes FLAGS. */
function flagUse(
  mnemonic: Mnemonic,
  category: Category,
  usesAlu: boolean
): { readsFlags: boolean; writesFlags: boolean } {
  return {
    // Every string instruction reads DF for its direction; REPE and REPNE also test ZF.
    readsFlags:
      READS_FLAGS.has(mnemonic) ||
      category === 'string' ||
      (category === 'control' && !JUMPS_WITHOUT_FLAGS.has(mnemonic)),
    writesFlags:
      WRITES_FLAGS.has(mnemonic) ||
      ((usesAlu || category === 'flags') && !KEEPS_FLAGS.has(mnemonic))
  };
}

export function decode(instruction: Instruction): Decoded {
  const { prefix, mnemonic, operands } = instruction;
  const form = matchingForms(mnemonic, operands).find((kinds) => kinds.length === operands.length);
  if (!form) {
    throw new Error(`Cannot decode an incomplete instruction: ${formatInstruction(instruction)}`);
  }

  const spec = getSpec(mnemonic);
  const { category } = spec;
  const size = instructionSize(instruction);
  const operandRoles = roles(mnemonic, category, operands.length);
  const usage = explicitUse(instruction);
  addImplicitUse(usage, instruction, category, size);

  const inOrder = (names: Set<WordRegister>) => WORD_REGISTERS.filter((name) => names.has(name));
  const usesAlu =
    category === 'arithmetic' ||
    category === 'logic' ||
    category === 'shift' ||
    isStringCompare(mnemonic);

  return {
    mnemonic,
    category,
    description: prefix ? `${REPEAT_PREFIXES[prefix]}: ${spec.description}` : spec.description,
    size,
    operands: operands.map((operand, index) => ({
      text: formatOperandOf(mnemonic, operand),
      kind: form[index],
      role: operandRoles[index]
    })),
    reads: inOrder(usage.reads),
    writes: inOrder(usage.writes),
    memory: usage.memory,
    port: mnemonic === 'in' ? 'read' : mnemonic === 'out' ? 'write' : null,
    stack: STACK_WRITERS.has(mnemonic) ? 'push' : STACK_READERS.has(mnemonic) ? 'pop' : null,
    ...flagUse(mnemonic, category, usesAlu),
    usesAlu
  };
}
