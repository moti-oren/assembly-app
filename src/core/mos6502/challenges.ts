import type { Challenge } from '../shared/challenge';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { getFlag, type CpuState } from './state';

const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

const a = (state: CpuState) => state.registers.a;
const x = (state: CpuState) => state.registers.x;

/** Where the fill challenge writes, and how many bytes. */
const FILL_START = 0x10;
const FILL_COUNT = 8;

function filledWith(state: CpuState, value: number): boolean {
  const bytes = state.memory.subarray(FILL_START, FILL_START + FILL_COUNT);
  return bytes.every((byte) => byte === value);
}

/** Small tasks for the 6502, each about getting by with one accumulator and 8 bits. */
// prettier-ignore
export const CHALLENGES: readonly Challenge<Instruction, CpuState>[] = [
  {
    id: 'mos6502-overflow',
    title: 'Overflow without a carry',
    brief: 'End with the V flag set and the C flag clear.',
    hint: 'V is about signed numbers and C about unsigned ones. Which byte is the largest positive signed number, and what is one more than it?',
    goals: ['V is 1', 'C is 0'],
    cases: [{ given: [], met: [(s) => getFlag(s, 'V'), (s) => !getFlag(s, 'C')] }],
    limits: { lines: 3 },
    par: 2
  },
  {
    id: 'mos6502-swap',
    title: 'Swap A and X',
    brief: 'Swap A and X. No instruction exchanges two registers, and Y must be left alone.',
    hint: 'Registers only move through A, so one of the two values has to wait somewhere else: a byte of the zero page will do.',
    goals: ['A holds what X had', 'X holds what A had'],
    cases: [
      { given: [line('lda', imm(0x11)), line('ldx', imm(0x22))], met: [(s) => a(s) === 0x22, (s) => x(s) === 0x11] },
      { given: [line('lda', imm(0x05)), line('ldx', imm(0x09))], met: [(s) => a(s) === 0x09, (s) => x(s) === 0x05] }
    ],
    limits: {
      lines: 3,
      without: [
        { label: 'No instruction that uses Y', mnemonics: ['tay', 'tya', 'ldy', 'sty', 'iny', 'dey', 'cpy'] }
      ]
    },
    par: 3
  },
  {
    id: 'mos6502-times-ten',
    title: 'Ten times, with no multiply',
    brief: 'Make A ten times what it starts as. The 6502 has no multiply at all.',
    hint: 'Ten is eight and two. ASL doubles A: keep the double in memory, double twice more, and add it back.',
    goals: ['A is ten times what it was'],
    cases: [
      { given: [line('lda', imm(7))], met: [(s) => a(s) === 70] },
      { given: [line('lda', imm(12))], met: [(s) => a(s) === 120] }
    ],
    limits: { lines: 8 },
    par: 6
  },
  {
    id: 'mos6502-decimal',
    title: 'Add as decimal',
    brief: 'A holds a two-digit decimal number, a digit in each half. Add 28 to it, so that A still reads as decimal: 19 becomes 47. C must say whether the sum passed 99.',
    hint: 'ADC adds in binary unless the D flag is set. Write the 28 the way A holds its number, as $28, and clear the carry first.',
    goals: ['A reads as its old number plus 28', 'C is 1 only when the sum passed 99'],
    // Each needs another correction, so no one binary number added does for all three.
    cases: [
      { given: [line('lda', imm(0x19))], met: [(s) => a(s) === 0x47, (s) => !getFlag(s, 'C')] },
      { given: [line('lda', imm(0x71))], met: [(s) => a(s) === 0x99, (s) => !getFlag(s, 'C')] },
      { given: [line('lda', imm(0x85))], met: [(s) => a(s) === 0x13, (s) => getFlag(s, 'C')] }
    ],
    limits: { lines: 3 },
    par: 3
  },
  {
    id: 'mos6502-fill',
    title: 'Fill eight bytes',
    brief: 'Store A in each of the eight bytes from $10 to $17, in no more than five lines.',
    hint: 'STA $10,X stores at $10 plus X. Count X down from 7; BPL goes round while X has not gone below zero.',
    goals: ['$10 to $17 all hold what A had'],
    cases: [
      { given: [line('lda', imm(0xaa))], met: [(s) => filledWith(s, 0xaa)] },
      { given: [line('lda', imm(0x3c))], met: [(s) => filledWith(s, 0x3c)] }
    ],
    limits: { lines: 5 },
    par: 4
  }
];
