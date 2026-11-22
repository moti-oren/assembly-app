import type { Size } from '../shared/numbers';
import {
  formatOperand,
  matchesKind,
  operandSize,
  type Operand,
  type OperandKind
} from './operands';

/**
 * The instruction set as data. Every legal combination of operands is listed as a "form",
 * so the same table drives validation, the instruction builder's menus and operand sizing.
 */

type Form = readonly OperandKind[];

const ALU_FORMS: Form[] = [
  ['r8', 'r8'],
  ['r8', 'imm8'],
  ['r8', 'm8'],
  ['m8', 'r8'],
  ['m8', 'imm8'],
  ['r16', 'r16'],
  ['r16', 'imm16'],
  ['r16', 'm16'],
  ['m16', 'r16'],
  ['m16', 'imm16']
];

/** A label as a source is the number of that program line: how a handler's address is stored. */
const MOV_FORMS: Form[] = [
  ...ALU_FORMS,
  ['r16', 'label'],
  ['m16', 'label'],
  ['sregw', 'r16'],
  ['sregw', 'm16'],
  ['r16', 'sreg'],
  ['m16', 'sreg']
];

const XCHG_FORMS: Form[] = [
  ['r8', 'r8'],
  ['r8', 'm8'],
  ['m8', 'r8'],
  ['r16', 'r16'],
  ['r16', 'm16'],
  ['m16', 'r16']
];

const UNARY_FORMS: Form[] = [['r8'], ['r16'], ['m8'], ['m16']];

const SHIFT_FORMS: Form[] = [
  ['r8', 'one'],
  ['r8', 'cl'],
  ['r16', 'one'],
  ['r16', 'cl'],
  ['m8', 'one'],
  ['m8', 'cl'],
  ['m16', 'one'],
  ['m16', 'cl']
];

/** The port is an 8-bit number or DX; the data always goes through AL or AX. */
const IN_FORMS: Form[] = [
  ['al', 'imm8'],
  ['al', 'dx'],
  ['ax', 'imm8'],
  ['ax', 'dx']
];

const OUT_FORMS: Form[] = [
  ['imm8', 'al'],
  ['imm8', 'ax'],
  ['dx', 'al'],
  ['dx', 'ax']
];

const NO_OPERANDS: Form[] = [[]];

const LABEL_FORMS: Form[] = [['label']];

export type Category =
  | 'transfer'
  | 'arithmetic'
  | 'logic'
  | 'shift'
  | 'string'
  | 'io'
  | 'control'
  | 'interrupt'
  | 'flags';

export const CATEGORY_LABELS: Record<Category, string> = {
  transfer: 'Data transfer',
  arithmetic: 'Arithmetic',
  logic: 'Logic',
  shift: 'Shift & rotate',
  string: 'String',
  io: 'Input & output',
  control: 'Jumps & calls',
  interrupt: 'Interrupts',
  flags: 'Flag control'
};

export interface InstructionSpec {
  category: Category;
  description: string;
  forms: readonly Form[];
  /** The operand size, for mnemonics that carry it in their name (MOVSB, MOVSW). */
  size?: Size;
}

export const INSTRUCTIONS = {
  mov: { category: 'transfer', description: 'dst = src', forms: MOV_FORMS },
  xchg: { category: 'transfer', description: 'Swap dst and src', forms: XCHG_FORMS },
  push: {
    category: 'transfer',
    description: 'SP -= 2, then [SS:SP] = src',
    forms: [['r16'], ['sreg'], ['m16']]
  },
  pop: {
    category: 'transfer',
    description: 'dst = [SS:SP], then SP += 2',
    forms: [['r16'], ['sregw'], ['m16']]
  },

  add: { category: 'arithmetic', description: 'dst = dst + src', forms: ALU_FORMS },
  adc: { category: 'arithmetic', description: 'dst = dst + src + CF', forms: ALU_FORMS },
  sub: { category: 'arithmetic', description: 'dst = dst - src', forms: ALU_FORMS },
  sbb: { category: 'arithmetic', description: 'dst = dst - src - CF', forms: ALU_FORMS },
  cmp: {
    category: 'arithmetic',
    description: 'Set flags as for dst - src, discard the result',
    forms: ALU_FORMS
  },
  inc: { category: 'arithmetic', description: 'dst = dst + 1 (CF unchanged)', forms: UNARY_FORMS },
  dec: { category: 'arithmetic', description: 'dst = dst - 1 (CF unchanged)', forms: UNARY_FORMS },
  neg: { category: 'arithmetic', description: "dst = -dst (two's complement)", forms: UNARY_FORMS },
  mul: {
    category: 'arithmetic',
    description: 'Unsigned: AX = AL * src, or DX:AX = AX * src',
    forms: UNARY_FORMS
  },
  imul: {
    category: 'arithmetic',
    description: 'Signed: AX = AL * src, or DX:AX = AX * src',
    forms: UNARY_FORMS
  },
  div: {
    category: 'arithmetic',
    description: 'Unsigned: AL,AH = AX / src, or AX,DX = DX:AX / src',
    forms: UNARY_FORMS
  },
  idiv: {
    category: 'arithmetic',
    description: 'Signed: AL,AH = AX / src, or AX,DX = DX:AX / src',
    forms: UNARY_FORMS
  },

  and: { category: 'logic', description: 'dst = dst AND src', forms: ALU_FORMS },
  or: { category: 'logic', description: 'dst = dst OR src', forms: ALU_FORMS },
  xor: { category: 'logic', description: 'dst = dst XOR src', forms: ALU_FORMS },
  not: { category: 'logic', description: 'dst = NOT dst (flags unchanged)', forms: UNARY_FORMS },
  test: {
    category: 'logic',
    description: 'Set flags as for dst AND src, discard the result',
    forms: ALU_FORMS
  },

  shl: { category: 'shift', description: 'Shift left, the top bit goes to CF', forms: SHIFT_FORMS },
  shr: {
    category: 'shift',
    description: 'Logical shift right, the low bit goes to CF',
    forms: SHIFT_FORMS
  },
  sar: {
    category: 'shift',
    description: 'Arithmetic shift right (keeps the sign)',
    forms: SHIFT_FORMS
  },
  rol: { category: 'shift', description: 'Rotate left', forms: SHIFT_FORMS },
  ror: { category: 'shift', description: 'Rotate right', forms: SHIFT_FORMS },
  rcl: { category: 'shift', description: 'Rotate left through CF', forms: SHIFT_FORMS },
  rcr: { category: 'shift', description: 'Rotate right through CF', forms: SHIFT_FORMS },

  movsb: {
    category: 'string',
    description: 'Copy the byte at DS:SI to ES:DI, then step SI and DI',
    forms: NO_OPERANDS,
    size: 8
  },
  movsw: {
    category: 'string',
    description: 'Copy the word at DS:SI to ES:DI, then step SI and DI',
    forms: NO_OPERANDS,
    size: 16
  },
  stosb: {
    category: 'string',
    description: 'Store AL at ES:DI, then step DI',
    forms: NO_OPERANDS,
    size: 8
  },
  stosw: {
    category: 'string',
    description: 'Store AX at ES:DI, then step DI',
    forms: NO_OPERANDS,
    size: 16
  },
  lodsb: {
    category: 'string',
    description: 'Load the byte at DS:SI into AL, then step SI',
    forms: NO_OPERANDS,
    size: 8
  },
  lodsw: {
    category: 'string',
    description: 'Load the word at DS:SI into AX, then step SI',
    forms: NO_OPERANDS,
    size: 16
  },
  scasb: {
    category: 'string',
    description: 'Set flags as for AL - the byte at ES:DI, then step DI',
    forms: NO_OPERANDS,
    size: 8
  },
  scasw: {
    category: 'string',
    description: 'Set flags as for AX - the word at ES:DI, then step DI',
    forms: NO_OPERANDS,
    size: 16
  },
  cmpsb: {
    category: 'string',
    description: 'Set flags as for the byte at DS:SI - the byte at ES:DI, then step SI and DI',
    forms: NO_OPERANDS,
    size: 8
  },
  cmpsw: {
    category: 'string',
    description: 'Set flags as for the word at DS:SI - the word at ES:DI, then step SI and DI',
    forms: NO_OPERANDS,
    size: 16
  },

  in: { category: 'io', description: 'Read AL or AX from an I/O port', forms: IN_FORMS },
  out: { category: 'io', description: 'Write AL or AX to an I/O port', forms: OUT_FORMS },

  jmp: { category: 'control', description: 'Always jump', forms: LABEL_FORMS },
  je: { category: 'control', description: 'Jump if equal (ZF = 1)', forms: LABEL_FORMS },
  jne: { category: 'control', description: 'Jump if not equal (ZF = 0)', forms: LABEL_FORMS },
  jz: { category: 'control', description: 'Jump if zero (ZF = 1)', forms: LABEL_FORMS },
  jnz: { category: 'control', description: 'Jump if not zero (ZF = 0)', forms: LABEL_FORMS },
  ja: {
    category: 'control',
    description: 'Unsigned: jump if above (CF = 0 and ZF = 0)',
    forms: LABEL_FORMS
  },
  jae: {
    category: 'control',
    description: 'Unsigned: jump if above or equal (CF = 0)',
    forms: LABEL_FORMS
  },
  jb: { category: 'control', description: 'Unsigned: jump if below (CF = 1)', forms: LABEL_FORMS },
  jbe: {
    category: 'control',
    description: 'Unsigned: jump if below or equal (CF = 1 or ZF = 1)',
    forms: LABEL_FORMS
  },
  jg: {
    category: 'control',
    description: 'Signed: jump if greater (ZF = 0 and SF = OF)',
    forms: LABEL_FORMS
  },
  jge: {
    category: 'control',
    description: 'Signed: jump if greater or equal (SF = OF)',
    forms: LABEL_FORMS
  },
  jl: { category: 'control', description: 'Signed: jump if less (SF ≠ OF)', forms: LABEL_FORMS },
  jle: {
    category: 'control',
    description: 'Signed: jump if less or equal (ZF = 1 or SF ≠ OF)',
    forms: LABEL_FORMS
  },
  jc: { category: 'control', description: 'Jump if carry (CF = 1)', forms: LABEL_FORMS },
  jnc: { category: 'control', description: 'Jump if no carry (CF = 0)', forms: LABEL_FORMS },
  js: { category: 'control', description: 'Jump if sign (SF = 1)', forms: LABEL_FORMS },
  jns: { category: 'control', description: 'Jump if no sign (SF = 0)', forms: LABEL_FORMS },
  jo: { category: 'control', description: 'Jump if overflow (OF = 1)', forms: LABEL_FORMS },
  jno: { category: 'control', description: 'Jump if no overflow (OF = 0)', forms: LABEL_FORMS },
  jp: { category: 'control', description: 'Jump if parity even (PF = 1)', forms: LABEL_FORMS },
  jnp: { category: 'control', description: 'Jump if parity odd (PF = 0)', forms: LABEL_FORMS },
  jcxz: { category: 'control', description: 'Jump if CX = 0', forms: LABEL_FORMS },
  loop: {
    category: 'control',
    description: 'CX -= 1, jump if CX ≠ 0 (flags unchanged)',
    forms: LABEL_FORMS
  },
  loope: {
    category: 'control',
    description: 'CX -= 1, jump if CX ≠ 0 and ZF = 1',
    forms: LABEL_FORMS
  },
  loopne: {
    category: 'control',
    description: 'CX -= 1, jump if CX ≠ 0 and ZF = 0',
    forms: LABEL_FORMS
  },
  call: {
    category: 'control',
    description: 'Push IP (the next line), then jump',
    forms: LABEL_FORMS
  },
  ret: {
    category: 'control',
    description: 'Pop IP: return to the line after the CALL',
    forms: NO_OPERANDS
  },

  int: {
    category: 'interrupt',
    description: 'Push FLAGS, CS and IP, then jump to the handler in vector n (at 0000:n×4)',
    forms: [['imm8']]
  },
  into: {
    category: 'interrupt',
    description: 'Interrupt 4 if OF = 1, otherwise do nothing',
    forms: NO_OPERANDS
  },
  iret: {
    category: 'interrupt',
    description: 'Pop IP, CS and FLAGS: return from an interrupt handler',
    forms: NO_OPERANDS
  },

  pushf: { category: 'flags', description: 'Push FLAGS onto the stack', forms: NO_OPERANDS },
  popf: { category: 'flags', description: 'Pop FLAGS off the stack', forms: NO_OPERANDS },
  clc: { category: 'flags', description: 'CF = 0', forms: NO_OPERANDS },
  stc: { category: 'flags', description: 'CF = 1', forms: NO_OPERANDS },
  cmc: { category: 'flags', description: 'CF = NOT CF', forms: NO_OPERANDS },
  cld: { category: 'flags', description: 'DF = 0', forms: NO_OPERANDS },
  std: { category: 'flags', description: 'DF = 1', forms: NO_OPERANDS },
  cli: { category: 'flags', description: 'IF = 0', forms: NO_OPERANDS },
  sti: { category: 'flags', description: 'IF = 1', forms: NO_OPERANDS },
  nop: { category: 'flags', description: 'Do nothing', forms: NO_OPERANDS }
} satisfies Record<string, InstructionSpec>;

export type Mnemonic = keyof typeof INSTRUCTIONS;

export const MNEMONICS = Object.keys(INSTRUCTIONS) as Mnemonic[];

/** String instructions that compare, and so are the ones REPE and REPNE can stop early. */
const STRING_COMPARES: readonly Mnemonic[] = ['scasb', 'scasw', 'cmpsb', 'cmpsw'];

export function isStringCompare(mnemonic: Mnemonic): boolean {
  return STRING_COMPARES.includes(mnemonic);
}

/** Prefixes that repeat a string instruction, counting CX down to 0. */
export const REPEAT_PREFIXES = {
  rep: 'Repeat CX times',
  repe: 'Repeat while CX ≠ 0 and the compared values are equal (ZF = 1)',
  repne: 'Repeat while CX ≠ 0 and the compared values differ (ZF = 0)'
} as const;

export type RepeatPrefix = keyof typeof REPEAT_PREFIXES;

/** REP goes with the string instructions that move data, REPE and REPNE with the ones that compare. */
export function prefixAllows(prefix: RepeatPrefix, mnemonic: Mnemonic): boolean {
  if (INSTRUCTIONS[mnemonic].category !== 'string') return false;
  return (prefix === 'rep') !== isStringCompare(mnemonic);
}

export interface Instruction {
  /** Only string instructions take a prefix. */
  prefix?: RepeatPrefix;
  mnemonic: Mnemonic;
  operands: Operand[];
}

export function getSpec(mnemonic: Mnemonic): InstructionSpec {
  return INSTRUCTIONS[mnemonic];
}

/** Forms whose first `operands.length` positions accept the operands chosen so far. */
export function matchingForms(mnemonic: Mnemonic, operands: readonly Operand[]): Form[] {
  return getSpec(mnemonic).forms.filter(
    (form) =>
      form.length >= operands.length &&
      operands.every((operand, index) => matchesKind(form[index], operand))
  );
}

export function isComplete(mnemonic: Mnemonic, operands: readonly Operand[]): boolean {
  return matchingForms(mnemonic, operands).some((form) => form.length === operands.length);
}

/**
 * The operand size of an instruction: fixed by the mnemonic, or that of its first register or
 * memory operand. Null when nothing has a size (jumps, flag control).
 */
export function instructionSize({ mnemonic, operands }: Instruction): Size | null {
  const fixed = getSpec(mnemonic).size;
  if (fixed) return fixed;
  // In `out dx, al` DX is only the port number: the data is the second operand.
  const sized = mnemonic === 'out' ? operands.slice(1) : operands;
  return sized.map(operandSize).find((size) => size !== null) ?? null;
}

/** True when the operands form a legal instruction and the prefix, if any, fits the mnemonic. */
export function isValid(instruction: Instruction): boolean {
  const { prefix, mnemonic, operands } = instruction;
  // Own keys only: `in` would take `constructor` and the like for prefixes.
  if (prefix !== undefined && !Object.hasOwn(REPEAT_PREFIXES, prefix)) return false;
  return isComplete(mnemonic, operands) && (!prefix || prefixAllows(prefix, mnemonic));
}

export function formatInstruction(instruction: Instruction): string {
  const operands = instruction.operands.map(formatOperand).join(', ');
  const body = operands ? `${instruction.mnemonic} ${operands}` : instruction.mnemonic;
  return instruction.prefix ? `${instruction.prefix} ${body}` : body;
}
