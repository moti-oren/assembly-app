import { formatOperand, modeOf, type Mode, type Operand } from './operands';

/**
 * The 56 instructions of the NMOS 6502 and their 151 opcodes, as data. Each mnemonic lists the
 * addressing modes it has, with the opcode for each and the cycles it takes.
 */

export interface Opcode {
  opcode: number;
  cycles: number;
  /** One cycle more when indexing carries into the next page of memory. */
  pageCross?: boolean;
}

const op = (opcode: number, cycles: number, pageCross = false): Opcode => ({
  opcode,
  cycles,
  pageCross
});

export type Category =
  | 'load'
  | 'transfer'
  | 'stack'
  | 'arithmetic'
  | 'logic'
  | 'shift'
  | 'jump'
  | 'branch'
  | 'flags'
  | 'interrupt';

export const CATEGORY_LABELS: Record<Category, string> = {
  load: 'Load & store',
  transfer: 'Transfer between registers',
  stack: 'Stack',
  arithmetic: 'Arithmetic & compare',
  logic: 'Logic',
  shift: 'Shift & rotate',
  jump: 'Jump & subroutine',
  branch: 'Branch',
  flags: 'Flags',
  interrupt: 'Interrupt & other'
};

export interface InstructionSpec {
  category: Category;
  description: string;
  modes: Partial<Record<Mode, Opcode>>;
}

/** The eight modes of the ALU instructions that read memory, at the same cycle costs. */
function aluModes(
  imm: number,
  zp: number,
  zpx: number,
  abs: number,
  abx: number,
  aby: number,
  izx: number,
  izy: number
) {
  return {
    imm: op(imm, 2),
    zp: op(zp, 3),
    zpx: op(zpx, 4),
    abs: op(abs, 4),
    abx: op(abx, 4, true),
    aby: op(aby, 4, true),
    izx: op(izx, 6),
    izy: op(izy, 5, true)
  };
}

/** Read-modify-write: the shifts and INC/DEC, which read a byte and write it back. */
function rmwModes(zp: number, zpx: number, abs: number, abx: number, acc?: number) {
  return {
    ...(acc === undefined ? {} : { acc: op(acc, 2) }),
    zp: op(zp, 5),
    zpx: op(zpx, 6),
    abs: op(abs, 6),
    abx: op(abx, 7)
  };
}

const implied = (opcode: number, cycles = 2) => ({ imp: op(opcode, cycles) });
const branch = (opcode: number) => ({ rel: op(opcode, 2) });

// prettier-ignore
export const INSTRUCTIONS = {
  lda: { category: 'load', description: 'A = the operand', modes: aluModes(0xa9, 0xa5, 0xb5, 0xad, 0xbd, 0xb9, 0xa1, 0xb1) },
  ldx: { category: 'load', description: 'X = the operand', modes: { imm: op(0xa2, 2), zp: op(0xa6, 3), zpy: op(0xb6, 4), abs: op(0xae, 4), aby: op(0xbe, 4, true) } },
  ldy: { category: 'load', description: 'Y = the operand', modes: { imm: op(0xa0, 2), zp: op(0xa4, 3), zpx: op(0xb4, 4), abs: op(0xac, 4), abx: op(0xbc, 4, true) } },
  sta: { category: 'load', description: 'The operand = A', modes: { zp: op(0x85, 3), zpx: op(0x95, 4), abs: op(0x8d, 4), abx: op(0x9d, 5), aby: op(0x99, 5), izx: op(0x81, 6), izy: op(0x91, 6) } },
  stx: { category: 'load', description: 'The operand = X', modes: { zp: op(0x86, 3), zpy: op(0x96, 4), abs: op(0x8e, 4) } },
  sty: { category: 'load', description: 'The operand = Y', modes: { zp: op(0x84, 3), zpx: op(0x94, 4), abs: op(0x8c, 4) } },

  tax: { category: 'transfer', description: 'X = A', modes: implied(0xaa) },
  tay: { category: 'transfer', description: 'Y = A', modes: implied(0xa8) },
  txa: { category: 'transfer', description: 'A = X', modes: implied(0x8a) },
  tya: { category: 'transfer', description: 'A = Y', modes: implied(0x98) },
  tsx: { category: 'transfer', description: 'X = SP', modes: implied(0xba) },
  txs: { category: 'transfer', description: 'SP = X (flags unchanged)', modes: implied(0x9a) },

  pha: { category: 'stack', description: 'Push A onto the stack', modes: implied(0x48, 3) },
  php: { category: 'stack', description: 'Push P, with B set, onto the stack', modes: implied(0x08, 3) },
  pla: { category: 'stack', description: 'Pull A from the stack', modes: implied(0x68, 4) },
  plp: { category: 'stack', description: 'Pull P from the stack', modes: implied(0x28, 4) },

  adc: { category: 'arithmetic', description: 'A = A + the operand + C (decimal when D = 1)', modes: aluModes(0x69, 0x65, 0x75, 0x6d, 0x7d, 0x79, 0x61, 0x71) },
  sbc: { category: 'arithmetic', description: 'A = A - the operand - (1 - C) (decimal when D = 1)', modes: aluModes(0xe9, 0xe5, 0xf5, 0xed, 0xfd, 0xf9, 0xe1, 0xf1) },
  cmp: { category: 'arithmetic', description: 'Set flags as for A - the operand: C = 1 if A ≥ it', modes: aluModes(0xc9, 0xc5, 0xd5, 0xcd, 0xdd, 0xd9, 0xc1, 0xd1) },
  cpx: { category: 'arithmetic', description: 'Set flags as for X - the operand', modes: { imm: op(0xe0, 2), zp: op(0xe4, 3), abs: op(0xec, 4) } },
  cpy: { category: 'arithmetic', description: 'Set flags as for Y - the operand', modes: { imm: op(0xc0, 2), zp: op(0xc4, 3), abs: op(0xcc, 4) } },
  inc: { category: 'arithmetic', description: 'The operand = the operand + 1', modes: rmwModes(0xe6, 0xf6, 0xee, 0xfe) },
  dec: { category: 'arithmetic', description: 'The operand = the operand - 1', modes: rmwModes(0xc6, 0xd6, 0xce, 0xde) },
  inx: { category: 'arithmetic', description: 'X = X + 1', modes: implied(0xe8) },
  iny: { category: 'arithmetic', description: 'Y = Y + 1', modes: implied(0xc8) },
  dex: { category: 'arithmetic', description: 'X = X - 1', modes: implied(0xca) },
  dey: { category: 'arithmetic', description: 'Y = Y - 1', modes: implied(0x88) },

  and: { category: 'logic', description: 'A = A AND the operand', modes: aluModes(0x29, 0x25, 0x35, 0x2d, 0x3d, 0x39, 0x21, 0x31) },
  ora: { category: 'logic', description: 'A = A OR the operand', modes: aluModes(0x09, 0x05, 0x15, 0x0d, 0x1d, 0x19, 0x01, 0x11) },
  eor: { category: 'logic', description: 'A = A XOR the operand', modes: aluModes(0x49, 0x45, 0x55, 0x4d, 0x5d, 0x59, 0x41, 0x51) },
  bit: { category: 'logic', description: 'Z = (A AND the operand) = 0; N and V = its bits 7 and 6', modes: { zp: op(0x24, 3), abs: op(0x2c, 4) } },

  asl: { category: 'shift', description: 'Shift left; bit 7 goes to C', modes: rmwModes(0x06, 0x16, 0x0e, 0x1e, 0x0a) },
  lsr: { category: 'shift', description: 'Shift right; bit 0 goes to C', modes: rmwModes(0x46, 0x56, 0x4e, 0x5e, 0x4a) },
  rol: { category: 'shift', description: 'Rotate left through C', modes: rmwModes(0x26, 0x36, 0x2e, 0x3e, 0x2a) },
  ror: { category: 'shift', description: 'Rotate right through C', modes: rmwModes(0x66, 0x76, 0x6e, 0x7e, 0x6a) },

  jmp: { category: 'jump', description: 'Jump', modes: { abs: op(0x4c, 3), ind: op(0x6c, 5) } },
  jsr: { category: 'jump', description: 'Push the address of its own last byte, then jump', modes: { abs: op(0x20, 6) } },
  rts: { category: 'jump', description: 'Pull an address, add 1, jump there', modes: implied(0x60, 6) },

  bcc: { category: 'branch', description: 'Branch if C = 0', modes: branch(0x90) },
  bcs: { category: 'branch', description: 'Branch if C = 1', modes: branch(0xb0) },
  beq: { category: 'branch', description: 'Branch if Z = 1 (equal)', modes: branch(0xf0) },
  bne: { category: 'branch', description: 'Branch if Z = 0 (not equal)', modes: branch(0xd0) },
  bmi: { category: 'branch', description: 'Branch if N = 1 (minus)', modes: branch(0x30) },
  bpl: { category: 'branch', description: 'Branch if N = 0 (plus)', modes: branch(0x10) },
  bvc: { category: 'branch', description: 'Branch if V = 0', modes: branch(0x50) },
  bvs: { category: 'branch', description: 'Branch if V = 1', modes: branch(0x70) },

  clc: { category: 'flags', description: 'C = 0', modes: implied(0x18) },
  sec: { category: 'flags', description: 'C = 1', modes: implied(0x38) },
  cli: { category: 'flags', description: 'I = 0', modes: implied(0x58) },
  sei: { category: 'flags', description: 'I = 1', modes: implied(0x78) },
  cld: { category: 'flags', description: 'D = 0: binary arithmetic', modes: implied(0xd8) },
  sed: { category: 'flags', description: 'D = 1: decimal (BCD) arithmetic', modes: implied(0xf8) },
  clv: { category: 'flags', description: 'V = 0', modes: implied(0xb8) },

  brk: { category: 'interrupt', description: 'Push PC + 2 and P, set I, jump through the vector at $FFFE', modes: implied(0x00, 7) },
  rti: { category: 'interrupt', description: 'Pull P, then PC: return from an interrupt', modes: implied(0x40, 6) },
  nop: { category: 'interrupt', description: 'Do nothing', modes: implied(0xea) }
} satisfies Record<string, InstructionSpec>;

export type Mnemonic = keyof typeof INSTRUCTIONS;

export const MNEMONICS = Object.keys(INSTRUCTIONS) as Mnemonic[];

export interface Instruction {
  mnemonic: Mnemonic;
  operands: Operand[];
}

export function getSpec(mnemonic: Mnemonic): InstructionSpec {
  return INSTRUCTIONS[mnemonic];
}

export function isBranch(mnemonic: Mnemonic): boolean {
  return getSpec(mnemonic).category === 'branch';
}

export function modeOfInstruction({ mnemonic, operands }: Instruction): Mode {
  return modeOf(operands[0], isBranch(mnemonic));
}

/** The opcode and cycles of an instruction, or null when the mnemonic has no such mode. */
export function opcodeOf(instruction: Instruction): Opcode | null {
  return getSpec(instruction.mnemonic).modes[modeOfInstruction(instruction)] ?? null;
}

function inRange(operand: Operand): boolean {
  const byte = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xff;
  const word = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xffff;
  switch (operand.type) {
    case 'imm':
      return Number.isInteger(operand.value) && operand.value >= -128 && operand.value <= 0xff;
    case 'zp':
    case 'izx':
    case 'izy':
      return byte(operand.address);
    case 'abs':
    case 'ind':
      return word(operand.address);
    default:
      return true;
  }
}

/** JMP and JSR jump to program lines: a numeric absolute address could land between them. */
export function isValid(instruction: Instruction): boolean {
  const { mnemonic, operands } = instruction;
  if (operands.length > 1 || !opcodeOf(instruction) || !operands.every(inRange)) return false;
  if ((mnemonic === 'jmp' || mnemonic === 'jsr') && operands[0]?.type === 'abs') return false;
  return true;
}

export function formatInstruction({ mnemonic, operands }: Instruction): string {
  return operands.length ? `${mnemonic} ${operands.map(formatOperand).join(', ')}` : mnemonic;
}
