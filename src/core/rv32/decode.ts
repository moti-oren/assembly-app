import { signExtend, u32 } from './bits';
import {
  formatInstruction,
  getSpec,
  type Category,
  type Format,
  type Instruction,
  type Mnemonic
} from './instructions';
import type { AccessSize } from './memory';
import type { Operand } from './operands';

/** Where the ALU's first input comes from: a register, or the address of the instruction. */
type AluInputA = 'rs1' | 'pc';
/** Where its second input comes from: a register, or the immediate. */
type AluInputB = 'rs2' | 'immediate';

/** What a control unit works out from an instruction before it runs. */
export interface Decoded {
  mnemonic: Mnemonic;
  text: string;
  category: Category;
  format: Format;
  description: string;
  rd: number | null;
  rs1: number | null;
  rs2: number | null;
  /** The immediate as the CPU uses it: sign-extended, or shifted up for LUI and AUIPC. */
  immediate: number | null;
  /** The registers it reads and writes; x0 is never written. */
  reads: number[];
  writes: number[];
  /** The ALU's inputs, or null when it does not use the ALU. */
  alu: { a: AluInputA; b: AluInputB } | null;
  memory: { access: 'load' | 'store'; size: AccessSize } | null;
  /** Where the next PC comes from: the next line, a branch that may be taken, or a jump. */
  nextPc: 'next' | 'branch' | 'jump';
  /** What is written into rd: the ALU's result, a loaded value, the link, or LUI's value. */
  writeBack: 'alu' | 'memory' | 'link' | 'immediate' | null;
}

const SIZES: Partial<Record<Mnemonic, AccessSize>> = {
  lb: 1,
  lbu: 1,
  sb: 1,
  lh: 2,
  lhu: 2,
  sh: 2,
  lw: 4,
  sw: 4
};

type Reg = Extract<Operand, { type: 'reg' }>;
type Mem = Extract<Operand, { type: 'mem' }>;
type Imm = Extract<Operand, { type: 'imm' }>;

/** rd, rs1, rs2 and the immediate, from the operands in the order the format gives them. */
function fields(instruction: Instruction): Pick<Decoded, 'rd' | 'rs1' | 'rs2' | 'immediate'> {
  const [a, b, c] = instruction.operands;
  const reg = (operand: Operand) => (operand as Reg).index;
  switch (getSpec(instruction.mnemonic).format) {
    case 'R':
      return { rd: reg(a), rs1: reg(b), rs2: reg(c), immediate: null };
    case 'I':
      if (b.type === 'mem') {
        return { rd: reg(a), rs1: b.base, rs2: null, immediate: signExtend(b.offset, 12) };
      }
      return { rd: reg(a), rs1: reg(b), rs2: null, immediate: signExtend((c as Imm).value, 12) };
    case 'S':
      return {
        rd: null,
        rs1: (b as Mem).base,
        rs2: reg(a),
        immediate: signExtend((b as Mem).offset, 12)
      };
    case 'B':
      return { rd: null, rs1: reg(a), rs2: reg(b), immediate: null };
    case 'U':
      return { rd: reg(a), rs1: null, rs2: null, immediate: u32((b as Imm).value << 12) };
    case 'J':
      return { rd: reg(a), rs1: null, rs2: null, immediate: null };
  }
}

function aluInputs(mnemonic: Mnemonic, category: Category, format: Format): Decoded['alu'] {
  if (mnemonic === 'auipc') return { a: 'pc', b: 'immediate' };
  if (mnemonic === 'lui' || mnemonic === 'jal' || category === 'branch') return null;
  return { a: 'rs1', b: format === 'R' ? 'rs2' : 'immediate' };
}

function writeBack(mnemonic: Mnemonic, category: Category): Decoded['writeBack'] {
  if (category === 'store' || category === 'branch') return null;
  if (category === 'load') return 'memory';
  if (category === 'jump') return 'link';
  if (mnemonic === 'lui') return 'immediate';
  return 'alu';
}

export function decode(instruction: Instruction): Decoded {
  const { mnemonic } = instruction;
  const { category, format, description } = getSpec(mnemonic);
  const registers = fields(instruction);
  const { rd, rs1, rs2 } = registers;
  const size = SIZES[mnemonic];
  return {
    mnemonic,
    text: formatInstruction(instruction),
    category,
    format,
    description,
    ...registers,
    reads: [rs1, rs2].filter((index): index is number => index !== null),
    writes: rd !== null && rd !== 0 ? [rd] : [],
    alu: aluInputs(mnemonic, category, format),
    memory: size ? { access: category === 'load' ? 'load' : 'store', size } : null,
    nextPc: category === 'branch' ? 'branch' : category === 'jump' ? 'jump' : 'next',
    writeBack: writeBack(mnemonic, category)
  };
}
