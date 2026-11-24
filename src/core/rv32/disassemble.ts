import { field, s32 } from './bits';
import { fieldsFor, OPCODES, type EncodedField, type Slots } from './encode';
import { immediateOf } from './immediate';
import { getSpec, MNEMONICS, type Format, type Mnemonic } from './instructions';
import { formatRegister } from './operands';

/**
 * A 32-bit word read back as the instruction it encodes. **Display only**, as the encoder is:
 * the CPU runs instructions as data and never reads one from its bits.
 */
export interface Disassembly extends Slots {
  mnemonic: Mnemonic;
}

/** The registers each format keeps in the word. */
const REGISTERS: Record<Format, ('rd' | 'rs1' | 'rs2')[]> = {
  R: ['rd', 'rs1', 'rs2'],
  I: ['rd', 'rs1'],
  S: ['rs1', 'rs2'],
  B: ['rs1', 'rs2'],
  U: ['rd'],
  J: ['rd']
};

const REGISTER_BITS = { rd: [11, 7], rs1: [19, 15], rs2: [24, 20] } as const;

/** The instruction whose opcode, funct3 and funct7 are the word's, all seven bits of funct7. */
function mnemonicOf(word: number): Mnemonic | null {
  const found = MNEMONICS.find((mnemonic) => {
    const { opcode, funct3, funct7 } = OPCODES[mnemonic];
    return (
      field(word, 6, 0) === opcode &&
      (funct3 === undefined || field(word, 14, 12) === funct3) &&
      (funct7 === undefined || field(word, 31, 25) === funct7)
    );
  });
  return found ?? null;
}

/** The immediate as the encoder keeps it: a shift's is its amount, the others are sign-extended. */
function immediateIn(word: number, mnemonic: Mnemonic, format: Format): number | undefined {
  if (format === 'R') return undefined;
  if (getSpec(mnemonic).form.includes('shamt')) return field(word, 24, 20);
  return s32(immediateOf(word, format));
}

/** Reads a word back as an instruction, or null when it is none of RV32IM's. */
export function disassemble(word: number): Disassembly | null {
  const mnemonic = mnemonicOf(word);
  if (!mnemonic) return null;
  const { format } = getSpec(mnemonic);
  const read: Disassembly = { mnemonic, immediate: immediateIn(word, mnemonic, format) };
  for (const name of REGISTERS[format]) {
    const [high, low] = REGISTER_BITS[name];
    read[name] = field(word, high, low);
  }
  return read;
}

/** The fields of a word that is an instruction, as the encoder lays them out. */
export function wordLayout(word: number): EncodedField[] | null {
  const read = disassemble(word);
  return read && fieldsFor(read.mnemonic, read);
}

/** A distance from the instruction itself, as a branch or JAL keeps it: `pc + 16`. */
function formatDistance(distance: number): string {
  return distance < 0 ? `pc - ${-distance}` : `pc + ${distance}`;
}

/** The instruction as assembly; a branch's or a jump's target is a distance, not a line. */
export function formatDisassembly({ mnemonic, rd, rs1, rs2, immediate = 0 }: Disassembly): string {
  const { format, form } = getSpec(mnemonic);
  const reg = (index: number | undefined) => formatRegister(index ?? 0);
  const operands = {
    R: () => [reg(rd), reg(rs1), reg(rs2)],
    I: () =>
      form.includes('mem')
        ? [reg(rd), `${immediate}(${reg(rs1)})`]
        : [reg(rd), reg(rs1), String(immediate)],
    S: () => [reg(rs2), `${immediate}(${reg(rs1)})`],
    B: () => [reg(rs1), reg(rs2), formatDistance(immediate)],
    U: () => [reg(rd), `0x${(immediate >>> 12).toString(16)}`],
    J: () => [reg(rd), formatDistance(immediate)]
  }[format]();
  return `${mnemonic} ${operands.join(', ')}`;
}
