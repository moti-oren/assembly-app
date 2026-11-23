import type { Challenge } from '../shared/challenge';
import type { Instruction } from './instructions';
import { loadImmediate } from './pseudo';
import { REGISTER_KEYS } from './registers';
import { createCpuState, readRegister, type CpuState } from './state';

const A0 = 10;
const A1 = 11;

const a0 = (state: CpuState) => readRegister(state, A0);
const a1 = (state: CpuState) => readRegister(state, A1);
/** A value as the 32 bits a register holds. */
const bits = (value: number) => value >>> 0;

/** Whether every register but a0 and a1 holds what a fresh CPU's does. */
function othersUntouched(state: CpuState): boolean {
  const fresh = createCpuState().registers;
  return REGISTER_KEYS.every(
    (key, index) => index === A0 || index === A1 || state.registers[key] === fresh[key]
  );
}

const NO_BRANCH = {
  label: 'No branch',
  mnemonics: ['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu']
};
/** The whole M extension. */
const NO_MULTIPLY = {
  label: 'No multiply or divide',
  mnemonics: ['mul', 'mulh', 'mulhsu', 'mulhu', 'div', 'divu', 'rem', 'remu']
};

/** Small tasks for RISC-V, each about one thing its small instruction set makes you build. */
// prettier-ignore
export const CHALLENGES: readonly Challenge<Instruction, CpuState>[] = [
  {
    id: 'rv32-negate',
    title: 'Negate without SUB',
    brief: 'Make a0 the negative of what it starts as, without SUB and without the M extension.',
    hint: "In two's complement, the negative of a number is every bit flipped, plus one. XORI with -1 flips every bit.",
    goals: ['a0 is the negative of what it was'],
    cases: [
      { given: loadImmediate(A0, 25), met: [(s) => a0(s) === bits(-25)] },
      { given: loadImmediate(A0, 7), met: [(s) => a0(s) === bits(-7)] }
    ],
    limits: { lines: 2, without: [{ label: 'No SUB', mnemonics: ['sub'] }, NO_MULTIPLY] },
    par: 2
  },
  {
    id: 'rv32-absolute',
    title: 'Absolute value, no branch',
    brief: 'Make a0 its own absolute value, without a branch.',
    hint: 'SRAI by 31 gives 0 for a positive number and -1, all ones, for a negative one. XOR with it and subtract it: that changes nothing, or negates.',
    goals: ['a0 is its absolute value'],
    cases: [
      { given: loadImmediate(A0, -25), met: [(s) => a0(s) === 25] },
      { given: loadImmediate(A0, 13), met: [(s) => a0(s) === 13] }
    ],
    limits: { lines: 3, without: [NO_BRANCH] },
    par: 3
  },
  {
    id: 'rv32-times-ten',
    title: 'Ten times, without MUL',
    brief: 'Make a0 ten times what it starts as, without the M extension.',
    hint: 'Ten is eight and two. SLLI by 3 multiplies by eight.',
    goals: ['a0 is ten times what it was'],
    cases: [
      { given: loadImmediate(A0, 7), met: [(s) => a0(s) === 70] },
      { given: loadImmediate(A0, 12), met: [(s) => a0(s) === 120] }
    ],
    limits: { lines: 4, without: [NO_MULTIPLY] },
    par: 3
  },
  {
    id: 'rv32-swap',
    title: 'Swap with nothing to spare',
    brief: 'Swap a0 and a1, leaving every other register as it was.',
    hint: 'XOR a value into another twice and the other is back as it was. Three XORs are enough.',
    goals: ['a0 holds what a1 had', 'a1 holds what a0 had', 'No other register changed'],
    cases: [
      {
        given: [...loadImmediate(A0, 0x111), ...loadImmediate(A1, 0x222)],
        met: [(s) => a0(s) === 0x222, (s) => a1(s) === 0x111, othersUntouched]
      },
      {
        given: [...loadImmediate(A0, 5), ...loadImmediate(A1, 9)],
        met: [(s) => a0(s) === 9, (s) => a1(s) === 5, othersUntouched]
      }
    ],
    limits: { lines: 3 },
    par: 3
  },
  {
    id: 'rv32-count-bits',
    title: 'Count the ones',
    brief: 'Leave in a1 the number of 1 bits a0 starts with.',
    hint: 'ANDI with 1 gives the lowest bit. Add it to the count, shift a0 right by one with SRLI, which brings in a 0 at the top, and go round while a0 is not zero.',
    goals: ['a1 is the number of 1 bits a0 had'],
    cases: [
      // One with its top bit set: a shift that copies that bit down never reaches zero.
      { given: loadImmediate(A0, 0x8000002d), met: [(s) => a1(s) === 5] },
      { given: loadImmediate(A0, 0x0001007f), met: [(s) => a1(s) === 8] }
    ],
    limits: { lines: 8 },
    par: 5
  }
];
