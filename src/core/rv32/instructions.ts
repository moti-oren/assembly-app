import { formatOperand, matchesKind, type Operand, type OperandKind } from './operands';

/**
 * The RV32I base instruction set and the M extension (multiply and divide), as data. Every
 * instruction has exactly one form: RISC-V keeps one meaning per mnemonic, so ADD always adds
 * two registers and ADDI always adds a register and an immediate.
 */

type Form = readonly OperandKind[];

const R: Form = ['reg', 'reg', 'reg'];
const I: Form = ['reg', 'reg', 'imm12'];
const SHIFT: Form = ['reg', 'reg', 'shamt'];
const LOAD: Form = ['reg', 'mem'];
const STORE: Form = ['reg', 'mem'];
const BRANCH: Form = ['reg', 'reg', 'label'];
const UPPER: Form = ['reg', 'imm20'];

/** The six ways RISC-V lays out the 32 bits of an instruction. */
export type Format = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';

export type Category =
  | 'arithmetic'
  | 'logic'
  | 'shift'
  | 'compare'
  | 'multiply'
  | 'load'
  | 'store'
  | 'branch'
  | 'jump'
  | 'upper';

export interface InstructionSpec {
  category: Category;
  format: Format;
  description: string;
  form: Form;
}

// prettier-ignore
export const INSTRUCTIONS = {
  add: { category: 'arithmetic', format: 'R', description: 'rd = rs1 + rs2', form: R },
  sub: { category: 'arithmetic', format: 'R', description: 'rd = rs1 - rs2', form: R },
  addi: { category: 'arithmetic', format: 'I', description: 'rd = rs1 + imm', form: I },

  and: { category: 'logic', format: 'R', description: 'rd = rs1 AND rs2', form: R },
  or: { category: 'logic', format: 'R', description: 'rd = rs1 OR rs2', form: R },
  xor: { category: 'logic', format: 'R', description: 'rd = rs1 XOR rs2', form: R },
  andi: { category: 'logic', format: 'I', description: 'rd = rs1 AND imm', form: I },
  ori: { category: 'logic', format: 'I', description: 'rd = rs1 OR imm', form: I },
  xori: { category: 'logic', format: 'I', description: 'rd = rs1 XOR imm', form: I },

  sll: { category: 'shift', format: 'R', description: 'rd = rs1 << rs2 (low 5 bits)', form: R },
  srl: { category: 'shift', format: 'R', description: 'rd = rs1 >> rs2, filling with 0', form: R },
  sra: { category: 'shift', format: 'R', description: 'rd = rs1 >> rs2, keeping the sign', form: R },
  slli: { category: 'shift', format: 'I', description: 'rd = rs1 << shamt', form: SHIFT },
  srli: { category: 'shift', format: 'I', description: 'rd = rs1 >> shamt, filling with 0', form: SHIFT },
  srai: { category: 'shift', format: 'I', description: 'rd = rs1 >> shamt, keeping the sign', form: SHIFT },

  slt: { category: 'compare', format: 'R', description: 'Signed: rd = 1 if rs1 < rs2, else 0', form: R },
  sltu: { category: 'compare', format: 'R', description: 'Unsigned: rd = 1 if rs1 < rs2, else 0', form: R },
  slti: { category: 'compare', format: 'I', description: 'Signed: rd = 1 if rs1 < imm, else 0', form: I },
  sltiu: { category: 'compare', format: 'I', description: 'Unsigned: rd = 1 if rs1 < imm (sign-extended), else 0', form: I },

  mul: { category: 'multiply', format: 'R', description: 'rd = low 32 bits of rs1 × rs2', form: R },
  mulh: { category: 'multiply', format: 'R', description: 'Signed: rd = high 32 bits of rs1 × rs2', form: R },
  mulhsu: { category: 'multiply', format: 'R', description: 'rd = high 32 bits of signed rs1 × unsigned rs2', form: R },
  mulhu: { category: 'multiply', format: 'R', description: 'Unsigned: rd = high 32 bits of rs1 × rs2', form: R },
  div: { category: 'multiply', format: 'R', description: 'Signed: rd = rs1 / rs2, rounded toward zero', form: R },
  divu: { category: 'multiply', format: 'R', description: 'Unsigned: rd = rs1 / rs2', form: R },
  rem: { category: 'multiply', format: 'R', description: 'Signed: rd = remainder of rs1 / rs2', form: R },
  remu: { category: 'multiply', format: 'R', description: 'Unsigned: rd = remainder of rs1 / rs2', form: R },

  lb: { category: 'load', format: 'I', description: 'rd = the byte at offset(rs1), sign-extended', form: LOAD },
  lh: { category: 'load', format: 'I', description: 'rd = the half-word at offset(rs1), sign-extended', form: LOAD },
  lw: { category: 'load', format: 'I', description: 'rd = the word at offset(rs1)', form: LOAD },
  lbu: { category: 'load', format: 'I', description: 'rd = the byte at offset(rs1), zero-extended', form: LOAD },
  lhu: { category: 'load', format: 'I', description: 'rd = the half-word at offset(rs1), zero-extended', form: LOAD },

  sb: { category: 'store', format: 'S', description: 'The byte at offset(rs1) = low byte of rs2', form: STORE },
  sh: { category: 'store', format: 'S', description: 'The half-word at offset(rs1) = low half of rs2', form: STORE },
  sw: { category: 'store', format: 'S', description: 'The word at offset(rs1) = rs2', form: STORE },

  beq: { category: 'branch', format: 'B', description: 'Jump if rs1 = rs2', form: BRANCH },
  bne: { category: 'branch', format: 'B', description: 'Jump if rs1 ≠ rs2', form: BRANCH },
  blt: { category: 'branch', format: 'B', description: 'Signed: jump if rs1 < rs2', form: BRANCH },
  bge: { category: 'branch', format: 'B', description: 'Signed: jump if rs1 ≥ rs2', form: BRANCH },
  bltu: { category: 'branch', format: 'B', description: 'Unsigned: jump if rs1 < rs2', form: BRANCH },
  bgeu: { category: 'branch', format: 'B', description: 'Unsigned: jump if rs1 ≥ rs2', form: BRANCH },

  jal: { category: 'jump', format: 'J', description: 'rd = address of the next instruction, then jump', form: ['reg', 'label'] },
  jalr: { category: 'jump', format: 'I', description: 'rd = address of the next instruction, then jump to offset(rs1)', form: ['reg', 'mem'] },

  lui: { category: 'upper', format: 'U', description: 'rd = imm << 12: the upper 20 bits, low 12 bits 0', form: UPPER },
  auipc: { category: 'upper', format: 'U', description: 'rd = address of this instruction + (imm << 12)', form: UPPER }
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

export function isValid({ mnemonic, operands }: Instruction): boolean {
  const { form } = getSpec(mnemonic);
  return (
    operands.length === form.length && operands.every((operand, i) => matchesKind(form[i], operand))
  );
}

export function formatInstruction({ mnemonic, operands }: Instruction): string {
  return operands.length ? `${mnemonic} ${operands.map(formatOperand).join(', ')}` : mnemonic;
}
