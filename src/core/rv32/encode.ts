import { formatLabel, type Program } from '../shared/program';
import { field, fitsSigned, u32 } from './bits';
import { getSpec, type Format, type Instruction, type Mnemonic } from './instructions';
import { formatRegister, type Operand } from './operands';
import { addressOfLine } from './state';

/**
 * The machine code of RV32IM instructions: always one 32-bit word, laid out in one of six
 * formats. Registers sit at the same bits in every format, so the CPU can read them before it
 * knows what the instruction is; the immediate is cut into pieces to make that possible.
 */
export type FieldName = 'opcode' | 'rd' | 'funct3' | 'rs1' | 'rs2' | 'funct7' | 'imm';

export interface EncodedField {
  name: FieldName;
  /** The bits of the instruction word it occupies, `high` down to `low`. */
  high: number;
  low: number;
  /** Those bits, as a number. */
  value: number;
  /** For a piece of the immediate, which of its bits these are: `imm[11:5]`. */
  label: string;
  note: string;
}

export interface Encoding {
  word: number;
  /** The word as it sits in memory, low byte first. */
  bytes: number[];
  format: Format;
  /** From bit 31 down to bit 0, the way the word is written. */
  fields: EncodedField[];
  /** Set when the instruction cannot be encoded as written, e.g. a branch out of range. */
  problem: string | null;
}

export interface AssembledLine {
  /** The address of the instruction in memory. */
  address: number;
  encoding: Encoding;
}

const OPCODE_NAMES = {
  0b0110111: 'LUI',
  0b0010111: 'AUIPC',
  0b1101111: 'JAL',
  0b1100111: 'JALR',
  0b1100011: 'BRANCH',
  0b0000011: 'LOAD',
  0b0100011: 'STORE',
  0b0010011: 'OP-IMM: register and immediate',
  0b0110011: 'OP: register and register'
} as const;

type Opcode = keyof typeof OPCODE_NAMES;

export interface OpcodeSpec {
  opcode: Opcode;
  funct3?: number;
  funct7?: number;
}

const OP = 0b0110011;
const OP_IMM = 0b0010011;
const LOAD = 0b0000011;
const STORE = 0b0100011;
const BRANCH = 0b1100011;
const MULDIV = 0b0000001;
const ALTERNATE = 0b0100000;

/** The opcode of every instruction, with the funct3 and funct7 that pick it within the opcode. */
// prettier-ignore
export const OPCODES: Record<Mnemonic, OpcodeSpec> = {
  add: { opcode: OP, funct3: 0, funct7: 0 }, sub: { opcode: OP, funct3: 0, funct7: ALTERNATE },
  sll: { opcode: OP, funct3: 1, funct7: 0 }, slt: { opcode: OP, funct3: 2, funct7: 0 },
  sltu: { opcode: OP, funct3: 3, funct7: 0 }, xor: { opcode: OP, funct3: 4, funct7: 0 },
  srl: { opcode: OP, funct3: 5, funct7: 0 }, sra: { opcode: OP, funct3: 5, funct7: ALTERNATE },
  or: { opcode: OP, funct3: 6, funct7: 0 }, and: { opcode: OP, funct3: 7, funct7: 0 },
  mul: { opcode: OP, funct3: 0, funct7: MULDIV }, mulh: { opcode: OP, funct3: 1, funct7: MULDIV },
  mulhsu: { opcode: OP, funct3: 2, funct7: MULDIV }, mulhu: { opcode: OP, funct3: 3, funct7: MULDIV },
  div: { opcode: OP, funct3: 4, funct7: MULDIV }, divu: { opcode: OP, funct3: 5, funct7: MULDIV },
  rem: { opcode: OP, funct3: 6, funct7: MULDIV }, remu: { opcode: OP, funct3: 7, funct7: MULDIV },
  addi: { opcode: OP_IMM, funct3: 0 }, slti: { opcode: OP_IMM, funct3: 2 },
  sltiu: { opcode: OP_IMM, funct3: 3 }, xori: { opcode: OP_IMM, funct3: 4 },
  ori: { opcode: OP_IMM, funct3: 6 }, andi: { opcode: OP_IMM, funct3: 7 },
  slli: { opcode: OP_IMM, funct3: 1, funct7: 0 }, srli: { opcode: OP_IMM, funct3: 5, funct7: 0 },
  srai: { opcode: OP_IMM, funct3: 5, funct7: ALTERNATE },
  lb: { opcode: LOAD, funct3: 0 }, lh: { opcode: LOAD, funct3: 1 }, lw: { opcode: LOAD, funct3: 2 },
  lbu: { opcode: LOAD, funct3: 4 }, lhu: { opcode: LOAD, funct3: 5 },
  sb: { opcode: STORE, funct3: 0 }, sh: { opcode: STORE, funct3: 1 }, sw: { opcode: STORE, funct3: 2 },
  beq: { opcode: BRANCH, funct3: 0 }, bne: { opcode: BRANCH, funct3: 1 },
  blt: { opcode: BRANCH, funct3: 4 }, bge: { opcode: BRANCH, funct3: 5 },
  bltu: { opcode: BRANCH, funct3: 6 }, bgeu: { opcode: BRANCH, funct3: 7 },
  jal: { opcode: 0b1101111 }, jalr: { opcode: 0b1100111, funct3: 0 },
  lui: { opcode: 0b0110111 }, auipc: { opcode: 0b0010111 }
};

/** Where the pieces of each format's immediate go: bits `high:low` of the word hold `imm[from:to]`. */
export interface ImmediatePiece {
  high: number;
  low: number;
  from: number;
  to: number;
}

export const IMMEDIATE_PIECES: Record<Exclude<Format, 'R'>, ImmediatePiece[]> = {
  I: [{ high: 31, low: 20, from: 11, to: 0 }],
  S: [
    { high: 31, low: 25, from: 11, to: 5 },
    { high: 11, low: 7, from: 4, to: 0 }
  ],
  B: [
    { high: 31, low: 31, from: 12, to: 12 },
    { high: 30, low: 25, from: 10, to: 5 },
    { high: 11, low: 8, from: 4, to: 1 },
    { high: 7, low: 7, from: 11, to: 11 }
  ],
  U: [{ high: 31, low: 12, from: 31, to: 12 }],
  J: [
    { high: 31, low: 31, from: 20, to: 20 },
    { high: 30, low: 21, from: 10, to: 1 },
    { high: 20, low: 20, from: 11, to: 11 },
    { high: 19, low: 12, from: 19, to: 12 }
  ]
};

const IMMEDIATE_NOTES: Record<Exclude<Format, 'R'>, string> = {
  I: 'The 12-bit immediate, sign-extended when used',
  S: 'The 12-bit offset, split around rs1 and rs2 so they stay where every format has them',
  B: 'The distance to jump, in bytes from this instruction. It is always even, so bit 0 is not stored',
  U: 'The upper 20 bits of the value; the low 12 are 0',
  J: 'The distance to jump, in bytes from this instruction. It is always even, so bit 0 is not stored'
};

type Reg = Extract<Operand, { type: 'reg' }>;
type Mem = Extract<Operand, { type: 'mem' }>;

/** The registers and immediate of an instruction, in the slots its format gives them. */
export interface Slots {
  rd?: number;
  rs1?: number;
  rs2?: number;
  /** The immediate as a number; for branches and JAL, the distance in bytes. */
  immediate?: number;
}

function slots(instruction: Instruction, distance: number): Slots {
  const [a, b, c] = instruction.operands;
  const reg = (operand: Operand) => (operand as Reg).index;
  const { format } = getSpec(instruction.mnemonic);
  switch (format) {
    case 'R':
      return { rd: reg(a), rs1: reg(b), rs2: reg(c) };
    case 'I':
      if (b.type === 'mem') return { rd: reg(a), rs1: b.base, immediate: b.offset };
      return { rd: reg(a), rs1: reg(b), immediate: (c as { value: number }).value };
    case 'S':
      return { rs2: reg(a), rs1: (b as Mem).base, immediate: (b as Mem).offset };
    case 'B':
      return { rs1: reg(a), rs2: reg(b), immediate: distance };
    case 'U':
      return { rd: reg(a), immediate: (b as { value: number }).value << 12 };
    case 'J':
      return { rd: reg(a), immediate: distance };
  }
}

function registerField(name: 'rd' | 'rs1' | 'rs2', index: number): EncodedField {
  const [high, low] = { rd: [11, 7], rs1: [19, 15], rs2: [24, 20] }[name];
  return {
    name,
    high,
    low,
    value: index,
    label: name,
    note: `${formatRegister(index)} (x${index})`
  };
}

function immediateFields(format: Exclude<Format, 'R'>, immediate: number): EncodedField[] {
  return IMMEDIATE_PIECES[format].map(({ high, low, from, to }) => ({
    name: 'imm',
    high,
    low,
    value: field(immediate, from, to),
    label: from === to ? `imm[${from}]` : `imm[${from}:${to}]`,
    note: IMMEDIATE_NOTES[format]
  }));
}

/** A shift by an immediate keeps funct7 in the top bits and the 5-bit amount below it. */
function isImmediateShift(mnemonic: Mnemonic): boolean {
  return mnemonic === 'slli' || mnemonic === 'srli' || mnemonic === 'srai';
}

/** The fields of the word that holds `mnemonic` with these registers and this immediate. */
export function fieldsFor(
  mnemonic: Mnemonic,
  { rd, rs1, rs2, immediate = 0 }: Slots
): EncodedField[] {
  const { format } = getSpec(mnemonic);
  const { opcode, funct3, funct7 } = OPCODES[mnemonic];
  const name = mnemonic.toUpperCase();
  const fields: EncodedField[] = [
    { name: 'opcode', high: 6, low: 0, value: opcode, label: 'opcode', note: OPCODE_NAMES[opcode] }
  ];
  if (rd !== undefined) fields.push(registerField('rd', rd));
  if (funct3 !== undefined) {
    fields.push({
      name: 'funct3',
      high: 14,
      low: 12,
      value: funct3,
      label: 'funct3',
      note: `Picks ${name} within its opcode`
    });
  }
  if (rs1 !== undefined) fields.push(registerField('rs1', rs1));
  if (rs2 !== undefined) fields.push(registerField('rs2', rs2));
  if (isImmediateShift(mnemonic)) {
    fields.push({
      name: 'imm',
      high: 24,
      low: 20,
      value: immediate & 31,
      label: 'shamt',
      note: 'The shift amount, 0 to 31'
    });
  } else if (format !== 'R') {
    fields.push(...immediateFields(format, immediate));
  }
  if (funct7 !== undefined) {
    const note =
      funct7 === MULDIV
        ? 'Marks a multiply or divide (the M extension)'
        : `Picks ${name} within its opcode`;
    fields.push({ name: 'funct7', high: 31, low: 25, value: funct7, label: 'funct7', note });
  }
  return fields.sort((x, y) => y.high - x.high);
}

/** Checks a branch or jump distance against what its immediate can hold. */
function distanceProblem(format: Format, distance: number, target: number): string | null {
  const bits = format === 'B' ? 13 : 21;
  if (fitsSigned(distance, bits)) return null;
  const reach = format === 'B' ? '4 KB' : '1 MB';
  return `Out of range: a ${format === 'B' ? 'branch' : 'JAL'} reaches only ${reach} either way, and ${formatLabel(target)} is ${distance} bytes away`;
}

/** Encodes one instruction as it is at `address`, which a branch or a jump measures from. */
export function encodeAt(instruction: Instruction, address: number): Encoding {
  const { format } = getSpec(instruction.mnemonic);
  const label = instruction.operands.find((operand) => operand.type === 'label');
  const distance = label ? addressOfLine(label.target) - address : 0;
  const fields = fieldsFor(instruction.mnemonic, slots(instruction, distance));
  const word = u32(fields.reduce((bits, { low, value }) => bits | (value << low), 0));
  return {
    word,
    bytes: [0, 8, 16, 24].map((shift) => (word >>> shift) & 0xff),
    format,
    fields,
    problem: label ? distanceProblem(format, distance, label.target) : null
  };
}

function encodeLine(instruction: Instruction, line: number): Encoding {
  return encodeAt(instruction, addressOfLine(line));
}

/** Encodes a whole program: line n is the word at address 4n. */
export function assemble(program: Program<Instruction>): { lines: AssembledLine[]; size: number } {
  const lines = program.map((instruction, line) => ({
    address: addressOfLine(line),
    encoding: encodeLine(instruction, line)
  }));
  return { lines, size: addressOfLine(program.length) };
}

/** Encodes one instruction as if it were the next line added at the end of `program`. */
export function encode(
  instruction: Instruction,
  program: Program<Instruction> = []
): AssembledLine {
  return {
    address: addressOfLine(program.length),
    encoding: encodeLine(instruction, program.length)
  };
}

/** The 32-bit word of program line `line`, as memory holds it. */
export function wordAt(program: Program<Instruction>, line: number): number {
  return encodeLine(program[line], line).word;
}
