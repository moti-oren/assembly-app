import { s32, u32 } from './bits';
import type { Mnemonic } from './instructions';

/** What the ALU computes from two 32-bit operands, both given and returned unsigned. */
type Operation = (a: number, b: number) => number;

const INT_MIN = 0x80000000;

/** The high 32 bits of a 64-bit product. */
function highWord(a: bigint, b: bigint): number {
  return Number(BigInt.asUintN(32, (a * b) >> 32n));
}

const signed = (value: number) => BigInt(s32(value));
const unsigned = (value: number) => BigInt(u32(value));

/** Signed division overflows only for the most negative number divided by -1. */
const overflows = (a: number, b: number) => a === INT_MIN && s32(b) === -1;

/**
 * Division never traps on RISC-V: dividing by zero gives all ones (and the dividend as the
 * remainder), and the one signed overflow gives the dividend back, so software checks if it cares.
 */
export const OPERATIONS = {
  add: (a, b) => u32(a + b),
  sub: (a, b) => u32(a - b),
  and: (a, b) => u32(a & b),
  or: (a, b) => u32(a | b),
  xor: (a, b) => u32(a ^ b),
  sll: (a, b) => u32(a << (b & 31)),
  srl: (a, b) => a >>> (b & 31),
  sra: (a, b) => u32(s32(a) >> (b & 31)),
  slt: (a, b) => (s32(a) < s32(b) ? 1 : 0),
  sltu: (a, b) => (a < b ? 1 : 0),
  mul: (a, b) => u32(Math.imul(a, b)),
  mulh: (a, b) => highWord(signed(a), signed(b)),
  mulhsu: (a, b) => highWord(signed(a), unsigned(b)),
  mulhu: (a, b) => highWord(unsigned(a), unsigned(b)),
  div: (a, b) => {
    if (b === 0) return 0xffffffff;
    if (overflows(a, b)) return INT_MIN;
    return u32(Math.trunc(s32(a) / s32(b)));
  },
  divu: (a, b) => (b === 0 ? 0xffffffff : Math.floor(a / b)),
  rem: (a, b) => {
    if (b === 0) return a;
    if (overflows(a, b)) return 0;
    return u32(s32(a) % s32(b));
  },
  remu: (a, b) => (b === 0 ? a : a % b)
} satisfies Partial<Record<Mnemonic, Operation>>;

export type AluMnemonic = keyof typeof OPERATIONS;

/** The register-and-immediate instructions are the same operations with an immediate as b. */
export const IMMEDIATE_OPERATIONS: Partial<Record<Mnemonic, AluMnemonic>> = {
  addi: 'add',
  andi: 'and',
  ori: 'or',
  xori: 'xor',
  slli: 'sll',
  srli: 'srl',
  srai: 'sra',
  slti: 'slt',
  sltiu: 'sltu'
};

/** Whether each branch is taken, from its two register values. */
export const BRANCH_CONDITIONS: Partial<Record<Mnemonic, (a: number, b: number) => boolean>> = {
  beq: (a, b) => a === b,
  bne: (a, b) => a !== b,
  blt: (a, b) => s32(a) < s32(b),
  bge: (a, b) => s32(a) >= s32(b),
  bltu: (a, b) => a < b,
  bgeu: (a, b) => a >= b
};
