import { fitsSigned, signExtend, s32, u32 } from './bits';
import type { Instruction, Mnemonic } from './instructions';
import { matchesKind, type Operand, type OperandKind } from './operands';
import { RA, ZERO } from './registers';

/**
 * Pseudo-instructions: names the assembler accepts and turns into one or two real instructions.
 * The playground expands them as they are added to the program, so the program shows exactly
 * what the CPU runs.
 */

/** Pseudo-instruction operands are the real kinds, plus `imm32`: any 32-bit value, for LI. */
export type PseudoKind = OperandKind | 'imm32';

interface PseudoSpec {
  description: string;
  form: readonly PseudoKind[];
  expand: (operands: Operand[]) => Instruction[];
}

const reg = (index: number): Operand => ({ type: 'reg', index });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (base: number, offset = 0): Operand => ({ type: 'mem', base, offset });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/**
 * LI: ADDI alone when the value fits in 12 signed bits, otherwise LUI for the upper 20 bits
 * then ADDI for the lower 12. ADDI sign-extends, so when bit 11 is set the lower part is
 * negative and LUI has to load one more to make up for it.
 */
export function loadImmediate(rd: number, value: number): Instruction[] {
  const target = s32(value);
  if (fitsSigned(target, 12)) return [line('addi', reg(rd), reg(ZERO), imm(target))];
  const low = s32(signExtend(target, 12));
  const high = (u32(target - low) >>> 12) & 0xfffff;
  const upper = line('lui', reg(rd), imm(high));
  return low === 0 ? [upper] : [upper, line('addi', reg(rd), reg(rd), imm(low))];
}

const BRANCH_FORM: readonly PseudoKind[] = ['reg', 'reg', 'label'];
const ZERO_BRANCH_FORM: readonly PseudoKind[] = ['reg', 'label'];

/** A branch with its two registers swapped: `bgt a, b` is `blt b, a`. */
const swapped =
  (mnemonic: Mnemonic) =>
  ([a, b, target]: Operand[]): Instruction[] => [line(mnemonic, b, a, target)];

// prettier-ignore
const PSEUDO_INSTRUCTIONS = {
  li: { description: 'rd = any 32-bit value', form: ['reg', 'imm32'], expand: ([rd, value]) => loadImmediate((rd as { index: number }).index, (value as { value: number }).value) },
  mv: { description: 'rd = rs (ADDI rd, rs, 0)', form: ['reg', 'reg'], expand: ([rd, rs]) => [line('addi', rd, rs, imm(0))] },
  not: { description: 'rd = NOT rs (XORI rd, rs, -1)', form: ['reg', 'reg'], expand: ([rd, rs]) => [line('xori', rd, rs, imm(-1))] },
  neg: { description: 'rd = -rs (SUB rd, zero, rs)', form: ['reg', 'reg'], expand: ([rd, rs]) => [line('sub', rd, reg(ZERO), rs)] },
  nop: { description: 'Do nothing (ADDI zero, zero, 0)', form: [], expand: () => [line('addi', reg(ZERO), reg(ZERO), imm(0))] },
  seqz: { description: 'rd = 1 if rs = 0 (SLTIU rd, rs, 1)', form: ['reg', 'reg'], expand: ([rd, rs]) => [line('sltiu', rd, rs, imm(1))] },
  snez: { description: 'rd = 1 if rs ≠ 0 (SLTU rd, zero, rs)', form: ['reg', 'reg'], expand: ([rd, rs]) => [line('sltu', rd, reg(ZERO), rs)] },
  j: { description: 'Jump (JAL zero, label: the link is thrown away)', form: ['label'], expand: ([target]) => [line('jal', reg(ZERO), target)] },
  jr: { description: 'Jump to the address in rs (JALR zero, 0(rs))', form: ['reg'], expand: ([rs]) => [line('jalr', reg(ZERO), at((rs as { index: number }).index))] },
  ret: { description: 'Return to the address in ra (JALR zero, 0(ra))', form: [], expand: () => [line('jalr', reg(ZERO), at(RA))] },
  beqz: { description: 'Jump if rs = 0 (BEQ rs, zero, label)', form: ZERO_BRANCH_FORM, expand: ([rs, target]) => [line('beq', rs, reg(ZERO), target)] },
  bnez: { description: 'Jump if rs ≠ 0 (BNE rs, zero, label)', form: ZERO_BRANCH_FORM, expand: ([rs, target]) => [line('bne', rs, reg(ZERO), target)] },
  bltz: { description: 'Jump if rs < 0 (BLT rs, zero, label)', form: ZERO_BRANCH_FORM, expand: ([rs, target]) => [line('blt', rs, reg(ZERO), target)] },
  bgez: { description: 'Jump if rs ≥ 0 (BGE rs, zero, label)', form: ZERO_BRANCH_FORM, expand: ([rs, target]) => [line('bge', rs, reg(ZERO), target)] },
  bgtz: { description: 'Jump if rs > 0 (BLT zero, rs, label)', form: ZERO_BRANCH_FORM, expand: ([rs, target]) => [line('blt', reg(ZERO), rs, target)] },
  blez: { description: 'Jump if rs ≤ 0 (BGE zero, rs, label)', form: ZERO_BRANCH_FORM, expand: ([rs, target]) => [line('bge', reg(ZERO), rs, target)] },
  bgt: { description: 'Signed: jump if rs > rt (BLT rt, rs, label)', form: BRANCH_FORM, expand: swapped('blt') },
  ble: { description: 'Signed: jump if rs ≤ rt (BGE rt, rs, label)', form: BRANCH_FORM, expand: swapped('bge') },
  bgtu: { description: 'Unsigned: jump if rs > rt (BLTU rt, rs, label)', form: BRANCH_FORM, expand: swapped('bltu') },
  bleu: { description: 'Unsigned: jump if rs ≤ rt (BGEU rt, rs, label)', form: BRANCH_FORM, expand: swapped('bgeu') }
} satisfies Record<string, PseudoSpec>;

export type PseudoMnemonic = keyof typeof PSEUDO_INSTRUCTIONS;

export const PSEUDO_MNEMONICS = Object.keys(PSEUDO_INSTRUCTIONS) as PseudoMnemonic[];

/** What a pseudo-instruction does, and the operands it takes. */
export function pseudoSpec(mnemonic: PseudoMnemonic): {
  description: string;
  form: readonly PseudoKind[];
} {
  const { description, form } = PSEUDO_INSTRUCTIONS[mnemonic];
  return { description, form };
}

export interface PseudoInstruction {
  mnemonic: PseudoMnemonic;
  operands: Operand[];
}

function matchesPseudoKind(kind: PseudoKind, operand: Operand): boolean {
  if (kind !== 'imm32') return matchesKind(kind, operand);
  return (
    operand.type === 'imm' &&
    Number.isInteger(operand.value) &&
    operand.value >= -(2 ** 31) &&
    operand.value < 2 ** 32
  );
}

export function isValidPseudo({ mnemonic, operands }: PseudoInstruction): boolean {
  const { form } = PSEUDO_INSTRUCTIONS[mnemonic];
  return (
    operands.length === form.length &&
    operands.every((operand, i) => matchesPseudoKind(form[i], operand))
  );
}

/** The real instructions a pseudo-instruction stands for, in order. */
export function expandPseudo(pseudo: PseudoInstruction): Instruction[] {
  if (!isValidPseudo(pseudo)) {
    throw new Error(`Cannot expand an incomplete pseudo-instruction: ${pseudo.mnemonic}`);
  }
  return PSEUDO_INSTRUCTIONS[pseudo.mnemonic].expand(pseudo.operands);
}
