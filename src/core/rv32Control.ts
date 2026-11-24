import type { ControlShape } from './controlLink';
import type { DecoderLine, DecoderTerm } from './logic/decoder';
import { bitOf, type Bit } from './logic/gates';
import { IMMEDIATE_OPERATIONS } from './rv32/alu';
import { OPCODES } from './rv32/encode';
import type { ImmediateFormat } from './rv32/immediate';
import { getSpec, MNEMONICS, type Mnemonic } from './rv32/instructions';

const OPCODE_WIRES = ['op6', 'op5', 'op4', 'op3', 'op2', 'op1', 'op0'];
const FUNCT3_WIRES = ['f3_2', 'f3_1', 'f3_0'];
/** The one bit of funct7 that tells SUB from ADD and SRA from SRL, and the one that marks M. */
const ALTERNATE = 'f7_5';
const MULDIV = 'f7_0';

const WIRES: Record<string, number> = {
  op6: 6,
  op5: 5,
  op4: 4,
  op3: 3,
  op2: 2,
  op1: 1,
  op0: 0,
  f3_2: 14,
  f3_1: 13,
  f3_0: 12,
  [ALTERNATE]: 30,
  [MULDIV]: 25
};

/** The kinds of instruction the main decoder tells apart, each by one opcode. */
const CLASSES = {
  OP: 'add',
  OP_IMM: 'addi',
  LOAD: 'lw',
  STORE: 'sw',
  BRANCH: 'beq',
  JAL: 'jal',
  JALR: 'jalr',
  LUI: 'lui',
  AUIPC: 'auipc'
} as const satisfies Record<string, Mnemonic>;

type ClassId = keyof typeof CLASSES;

/** The control lines, and the kinds of instruction that turn each one on. */
const MAIN_LINES: Record<string, ClassId[]> = {
  regWrite: ['OP', 'OP_IMM', 'LOAD', 'JAL', 'JALR', 'LUI', 'AUIPC'],
  aluSrcA: ['AUIPC'],
  aluSrcB: ['OP_IMM', 'LOAD', 'STORE', 'JALR', 'AUIPC'],
  aluAdd: ['LOAD', 'STORE', 'JALR', 'AUIPC'],
  memRead: ['LOAD'],
  memWrite: ['STORE'],
  fromMemory: ['LOAD'],
  link: ['JAL', 'JALR'],
  upper: ['LUI'],
  branch: ['BRANCH'],
  jump: ['JAL', 'JALR'],
  jumpRegister: ['JALR'],
  immI: ['OP_IMM', 'LOAD', 'JALR'],
  immS: ['STORE'],
  immB: ['BRANCH'],
  immU: ['LUI', 'AUIPC'],
  immJ: ['JAL']
};

/** The line of the main decoder that says how the immediate is laid out, for each format. */
export const IMMEDIATE_LINES: Record<string, ImmediateFormat> = {
  immI: 'I',
  immS: 'S',
  immB: 'B',
  immU: 'U',
  immJ: 'J'
};

/** What each ALU operation asks of the ALU's lines. */
const OPERATION_LINES: Record<string, string[]> = {
  add: ['aluSum'],
  sub: ['aluSum', 'aluSub'],
  and: ['aluAnd'],
  or: ['aluOr'],
  xor: ['aluXor'],
  sll: ['aluShift'],
  srl: ['aluShift', 'shiftRight'],
  sra: ['aluShift', 'shiftRight', 'shiftArithmetic'],
  slt: ['aluSub', 'setLess'],
  sltu: ['aluSub', 'setLessUnsigned']
};

/** A branch subtracts, reads one wire of the difference, and may turn it over. */
const BRANCH_LINES: Record<string, string[]> = {
  beq: ['aluSub', 'readZero'],
  bne: ['aluSub', 'readZero', 'invert'],
  blt: ['aluSub', 'readLess'],
  bge: ['aluSub', 'readLess', 'invert'],
  bltu: ['aluSub', 'readCarry', 'invert'],
  bgeu: ['aluSub', 'readCarry']
};

const ALU_LINE_ORDER = [
  'aluSum',
  'aluSub',
  'aluAnd',
  'aluOr',
  'aluXor',
  'aluShift',
  'shiftRight',
  'shiftArithmetic',
  'setLess',
  'setLessUnsigned',
  'mulDiv',
  'readZero',
  'readLess',
  'readCarry',
  'invert'
];

function bits(wires: readonly string[], value: number): Record<string, Bit> {
  return Object.fromEntries(
    wires.map((wire, index) => [wire, bitOf(value, wires.length - 1 - index)])
  );
}

const opcodeOf = (id: ClassId) => OPCODES[CLASSES[id]].opcode;

const MAIN_TERMS: DecoderTerm[] = (Object.keys(CLASSES) as ClassId[]).map((id) => ({
  id,
  match: bits(OPCODE_WIRES, opcodeOf(id))
}));

interface AluTerm extends DecoderTerm {
  lines: string[];
}

/** The term that recognises one instruction of `kind`, by its funct3 and what funct7 it has. */
function instructionTerm(mnemonic: Mnemonic, kind: ClassId, lines: string[]): AluTerm {
  const { funct3 = 0, funct7 } = OPCODES[mnemonic];
  const match: Record<string, Bit> = { [kind]: 1, ...bits(FUNCT3_WIRES, funct3) };
  if (funct7 !== undefined) match[ALTERNATE] = bitOf(funct7, 5);
  // In OP, bit 25 is what tells an M instruction from the one that shares its funct3.
  if (kind === 'OP') match[MULDIV] = 0;
  return { id: mnemonic, match, lines };
}

function aluTerms(): AluTerm[] {
  const terms: AluTerm[] = [{ id: 'address', match: { aluAdd: 1 }, lines: ['aluSum'] }];
  for (const mnemonic of MNEMONICS) {
    const { opcode } = OPCODES[mnemonic];
    if (mnemonic in BRANCH_LINES) {
      terms.push(instructionTerm(mnemonic, 'BRANCH', BRANCH_LINES[mnemonic]));
    } else if (opcode === opcodeOf('OP_IMM')) {
      const lines = OPERATION_LINES[IMMEDIATE_OPERATIONS[mnemonic]!];
      terms.push(instructionTerm(mnemonic, 'OP_IMM', lines));
    } else if (opcode === opcodeOf('OP') && getSpec(mnemonic).category !== 'multiply') {
      terms.push(instructionTerm(mnemonic, 'OP', OPERATION_LINES[mnemonic]));
    }
  }
  terms.push({ id: 'muldiv', match: { OP: 1, [MULDIV]: 1 }, lines: ['mulDiv'] });
  return terms;
}

const ALU_TERMS = aluTerms();

const lineOf = (id: string, terms: readonly string[]): DecoderLine => ({ id, terms });

/** RISC-V's control unit: nine kinds of instruction, and what each asks of the datapath. */
export const RV32_CONTROL: ControlShape = {
  wires: WIRES,
  reads: [
    {
      label: 'funct7[5]',
      high: 30,
      low: 30,
      note: 'Tells SUB from ADD and SRA from SRL',
      decoded: true
    },
    { label: 'funct7[0]', high: 25, low: 25, note: 'Marks a multiply or divide', decoded: true },
    {
      label: 'funct3',
      high: 14,
      low: 12,
      note: 'Picks the instruction within its opcode',
      decoded: true
    },
    { label: 'opcode', high: 6, low: 0, note: 'The kind of instruction', decoded: true }
  ],
  main: {
    inputs: OPCODE_WIRES,
    terms: MAIN_TERMS,
    lines: Object.entries(MAIN_LINES).map(([id, classes]) => lineOf(id, classes))
  },
  alu: {
    inputs: ['OP', 'OP_IMM', 'BRANCH', 'aluAdd', ...FUNCT3_WIRES, ALTERNATE, MULDIV],
    terms: ALU_TERMS.map(({ id, match }) => ({ id, match })),
    lines: ALU_LINE_ORDER.map((id) =>
      lineOf(
        id,
        ALU_TERMS.filter((term) => term.lines.includes(id)).map((term) => term.id)
      )
    )
  }
};
