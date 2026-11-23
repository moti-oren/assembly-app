import type { Challenge } from '../shared/challenge';
import { isFlagSet } from './flags';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { physicalAddress, type CpuState } from './state';

const reg = (name: Extract<Operand, { type: 'reg' }>['name']): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

const ax = (state: CpuState) => state.registers.ax;
const bx = (state: CpuState) => state.registers.bx;

const SEGMENT = 0x10000;

/**
 * Fills what a way to zero AX has no business reading: the other registers, the data and stack
 * segments and the input ports. A fresh CPU holds zeros there, which could simply be copied.
 */
function clutter(state: CpuState): void {
  for (const name of ['bx', 'cx', 'dx', 'si', 'di', 'bp'] as const) state.registers[name] = 0x5a5a;
  for (const segment of [state.registers.ds, state.registers.ss]) {
    const start = physicalAddress(segment, 0);
    state.memory.fill(0xa5, start, start + SEGMENT);
  }
  state.io.in.fill(0xa5);
}

const NO_MULTIPLY = { label: 'No MUL or IMUL', mnemonics: ['mul', 'imul'] };

/** Small tasks for the 8086, each about one thing the CPU does that is easy to get wrong. */
// prettier-ignore
export const CHALLENGES: readonly Challenge<Instruction, CpuState>[] = [
  {
    id: 'x86-overflow',
    title: 'Overflow without a carry',
    brief: 'End with the overflow flag set and the carry flag clear.',
    hint: 'OF is about signed numbers and CF about unsigned ones. Which byte is the largest positive signed number, and what is one more than it?',
    goals: ['OF is 1', 'CF is 0'],
    cases: [{ given: [], met: [(s) => isFlagSet(s.flags, 'OF'), (s) => !isFlagSet(s.flags, 'CF')] }],
    limits: { lines: 2 },
    par: 2
  },
  {
    id: 'x86-zero',
    title: 'Zero from nothing',
    brief: 'Make AX zero, without MOV and without writing any number. It is checked with other values in every other register and in memory, so there is no zero to borrow.',
    hint: 'What is left of a value when it is combined with itself? More than one instruction answers that.',
    goals: ['AX is 0'],
    cases: [
      { given: [line('mov', reg('ax'), imm(0x1234))], setup: clutter, met: [(s) => ax(s) === 0] },
      { given: [line('mov', reg('ax'), imm(0xbeef))], setup: clutter, met: [(s) => ax(s) === 0] }
    ],
    limits: { lines: 1, without: [{ label: 'No MOV', mnemonics: ['mov'] }], noNumbers: true },
    par: 1
  },
  {
    id: 'x86-times-ten',
    title: 'Ten times, without MUL',
    brief: 'Make AX ten times what it starts as, without MUL or IMUL.',
    hint: 'Ten is eight and two. A shift left doubles.',
    goals: ['AX is ten times what it was'],
    cases: [
      { given: [line('mov', reg('ax'), imm(7))], met: [(s) => ax(s) === 70] },
      { given: [line('mov', reg('ax'), imm(12))], met: [(s) => ax(s) === 120] }
    ],
    limits: { lines: 6, without: [NO_MULTIPLY] },
    par: 5
  },
  {
    id: 'x86-swap',
    title: 'Swap with nothing to spare',
    brief: 'Swap AX and BX, without MOV, XCHG or the stack.',
    hint: 'XOR a value into another twice and the other is back as it was. Three XORs are enough.',
    goals: ['AX holds what BX had', 'BX holds what AX had'],
    cases: [
      {
        given: [line('mov', reg('ax'), imm(0x1111)), line('mov', reg('bx'), imm(0x2222))],
        met: [(s) => ax(s) === 0x2222, (s) => bx(s) === 0x1111]
      },
      {
        given: [line('mov', reg('ax'), imm(0x0a0b)), line('mov', reg('bx'), imm(0x0c0d))],
        met: [(s) => ax(s) === 0x0c0d, (s) => bx(s) === 0x0a0b]
      }
    ],
    limits: {
      lines: 3,
      without: [
        { label: 'No MOV or XCHG', mnemonics: ['mov', 'xchg'] },
        { label: 'No PUSH or POP', mnemonics: ['push', 'pop'] }
      ]
    },
    par: 3
  },
  {
    id: 'x86-sum',
    title: 'Count down and add',
    brief: 'CX holds a count. Leave in AX the sum of every number from 1 up to it.',
    hint: 'LOOP takes 1 off CX and jumps back while it is not zero: add CX to AX on each pass.',
    goals: ['AX is 1 + 2 + … up to what CX was'],
    cases: [
      { given: [line('mov', reg('cx'), imm(10))], met: [(s) => ax(s) === 55] },
      { given: [line('mov', reg('cx'), imm(6))], met: [(s) => ax(s) === 21] }
    ],
    limits: { lines: 4, without: [NO_MULTIPLY] },
    par: 3
  }
];
