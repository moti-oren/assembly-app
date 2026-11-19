import type { Example } from './shared/architecture';
import { PORTS } from './shared/devices';
import type { Program } from './shared/program';
import { MOS6502 } from './mos6502/architecture';
import type { Instruction as Mos6502Instruction } from './mos6502/instructions';
import type { CpuState as Mos6502State } from './mos6502/state';
import { RV32 } from './rv32/architecture';
import type { Instruction as Rv32Instruction } from './rv32/instructions';
import { loadImmediate } from './rv32/pseudo';
import { readRegister as readRv32, type CpuState as Rv32State } from './rv32/state';
import { X86 } from './x86/architecture';
import type { Instruction as X86Instruction } from './x86/instructions';
import { physicalAddress, type CpuState as X86State } from './x86/state';

/**
 * The same small tasks written for each architecture, so their programs can be set side by side:
 * how many lines and bytes each needs, how many instructions it runs, and why they differ.
 */

/** One architecture's program for a task, and what it leaves behind, in words. */
export interface Solution<Instruction, State> {
  program: Program<Instruction>;
  result: (state: State) => string;
}

export interface ComparisonTask {
  id: string;
  name: string;
  /** What the difference between the programs shows. */
  lesson: string;
  x86: Solution<X86Instruction, X86State>;
  rv32: Solution<Rv32Instruction, Rv32State>;
  mos6502: Solution<Mos6502Instruction, Mos6502State>;
}

const hex = (value: number, digits: number) =>
  value.toString(16).toUpperCase().padStart(digits, '0');

/** An example program of an architecture, by its id. */
function example<I>(examples: readonly Example<I>[], id: string): Program<I> {
  const found = examples.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No example with the id ${id}`);
  return found.program;
}

type X86Operand = X86Instruction['operands'][number];
type Rv32Operand = Rv32Instruction['operands'][number];
type Mos6502Operand = Mos6502Instruction['operands'][number];

const x86 = {
  reg: (name: Extract<X86Operand, { type: 'reg' }>['name']): X86Operand => ({ type: 'reg', name }),
  imm: (value: number): X86Operand => ({ type: 'imm', value }),
  line: (mnemonic: X86Instruction['mnemonic'], ...operands: X86Operand[]): X86Instruction => ({
    mnemonic,
    operands
  })
};

const rv = {
  reg: (index: number): Rv32Operand => ({ type: 'reg', index }),
  imm: (value: number): Rv32Operand => ({ type: 'imm', value }),
  line: (mnemonic: Rv32Instruction['mnemonic'], ...operands: Rv32Operand[]): Rv32Instruction => ({
    mnemonic,
    operands
  })
};

const m65 = (
  mnemonic: Mos6502Instruction['mnemonic'],
  ...operands: Mos6502Operand[]
): Mos6502Instruction => ({ mnemonic, operands });

const ZERO = 0;
const T0 = 5;
const T1 = 6;
const A0 = 10;
const A1 = 11;
const A2 = 12;

/** The bytes from `start` up, as `2A 2A 2A …`. */
function bytesAt(memory: Uint8Array, start: number, count: number): string {
  return [...memory.slice(start, start + count)].map((byte) => hex(byte, 2)).join(' ');
}

const leds = (state: { io: { out: Uint8Array } }) => `LEDs = $${hex(state.io.out[PORTS.leds], 2)}`;

// prettier-ignore
export const COMPARISON_TASKS: readonly ComparisonTask[] = [
  {
    id: 'sum',
    name: 'Add 1 to 10',
    lesson: 'The 8086 has LOOP: it counts CX down and jumps back in one instruction. RISC-V counts down with ADDI and branches back with BNE. On the 6502 only A can add, and only a byte from memory, so X is stored in the zero page first.',
    x86: { program: example(X86.examples, 'sum'), result: (s) => `AX = ${s.registers.ax}` },
    rv32: { program: example(RV32.examples, 'sum'), result: (s) => `a0 = ${readRv32(s, A0)}` },
    mos6502: { program: example(MOS6502.examples, 'sum'), result: (s) => `A = ${s.registers.a}` }
  },
  {
    id: 'wide-add',
    name: 'Add $1234 and $00FF',
    lesson: 'A 16-bit sum is one ADD on the 8086 and on RISC-V, whose registers are 16 and 32 bits wide. The 6502 adds a byte at a time: the low bytes first, then the high bytes with the carry from the first ADC. RISC-V needs LUI to build $1234, which does not fit in ADDI\'s 12 bits.',
    x86: { program: [x86.line('mov', x86.reg('ax'), x86.imm(0x1234)), x86.line('add', x86.reg('ax'), x86.imm(0x00ff))], result: (s) => `AX = $${hex(s.registers.ax, 4)}` },
    rv32: { program: [...loadImmediate(A0, 0x1234), rv.line('addi', rv.reg(A0), rv.reg(A0), rv.imm(0xff))], result: (s) => `a0 = $${hex(readRv32(s, A0), 4)}` },
    mos6502: { program: example(MOS6502.examples, 'wide-add'), result: (s) => `$01:$00 = $${hex(s.memory[1], 2)}${hex(s.memory[0], 2)}` }
  },
  {
    id: 'multiply',
    name: 'Multiply 6 by 7',
    lesson: "The 8086's MUL and RISC-V's MUL (from the M extension) each multiply in one instruction, though the 8086's takes dozens of clock cycles inside. The 6502 has no multiply at all: it shifts the multiplier right and adds, once for each of its 8 bits.",
    x86: { program: [x86.line('mov', x86.reg('al'), x86.imm(6)), x86.line('mov', x86.reg('bl'), x86.imm(7)), x86.line('mul', x86.reg('bl'))], result: (s) => `AX = ${s.registers.ax}` },
    rv32: { program: [...loadImmediate(A0, 6), ...loadImmediate(A1, 7), rv.line('mul', rv.reg(A2), rv.reg(A0), rv.reg(A1))], result: (s) => `a2 = ${readRv32(s, A2)}` },
    mos6502: { program: example(MOS6502.examples, 'multiply'), result: (s) => `$01 = ${s.memory[1]}` }
  },
  {
    id: 'fill',
    name: 'Fill 8 bytes with $2A',
    lesson: 'REP STOSB fills all eight in a single instruction that repeats itself. RISC-V and the 6502 write the loop out. The 6502 keeps its counter and its index in one register: STA $0300,X stores at $0300 plus X.',
    x86: {
      program: [x86.line('mov', x86.reg('al'), x86.imm(0x2a)), x86.line('mov', x86.reg('di'), x86.imm(0)), x86.line('mov', x86.reg('cx'), x86.imm(8)), { prefix: 'rep', mnemonic: 'stosb', operands: [] }],
      result: (s) => `ES:0000 = ${bytesAt(s.memory, physicalAddress(s.registers.es, 0), 8)}`
    },
    rv32: {
      program: [rv.line('lui', rv.reg(A0), rv.imm(0x10)), rv.line('addi', rv.reg(T1), rv.reg(ZERO), rv.imm(0x2a)), rv.line('addi', rv.reg(T0), rv.reg(ZERO), rv.imm(8)), rv.line('sb', rv.reg(T1), { type: 'mem', base: A0, offset: 0 }), rv.line('addi', rv.reg(A0), rv.reg(A0), rv.imm(1)), rv.line('addi', rv.reg(T0), rv.reg(T0), rv.imm(-1)), rv.line('bne', rv.reg(T0), rv.reg(ZERO), { type: 'label', target: 3 })],
      result: (s) => `$00010000 = ${bytesAt(s.memory, 0x10000, 8)}`
    },
    mos6502: {
      program: [m65('ldx', { type: 'imm', value: 0 }), m65('lda', { type: 'imm', value: 0x2a }), m65('sta', { type: 'abs', address: 0x0300, index: 'x' }), m65('inx'), m65('cpx', { type: 'imm', value: 8 }), m65('bne', { type: 'label', target: 2 })],
      result: (s) => `$0300 = ${bytesAt(s.memory, 0x0300, 8)}`
    }
  },
  {
    id: 'call',
    name: 'Call a function that doubles 7',
    lesson: "CALL and JSR push the return address onto the stack, in memory. RISC-V's JAL keeps it in a register, ra, so a function that calls nothing else never touches memory. JSR pushes the address of its own last byte, which RTS corrects by adding 1.",
    x86: { program: example(X86.examples, 'call'), result: (s) => `AX = ${s.registers.ax}` },
    rv32: { program: example(RV32.examples, 'call'), result: (s) => `a0 = ${readRv32(s, A0)}` },
    mos6502: { program: example(MOS6502.examples, 'call'), result: (s) => `A = ${s.registers.a}` }
  },
  {
    id: 'light',
    name: 'Light the LEDs one at a time',
    lesson: 'The 8086 reaches the LEDs through a port of their own, with OUT. RISC-V and the 6502 have no I/O instructions: the LEDs are an address in memory, written with SB or STA. The 6502 needs no counter: after eight shifts ASL pushes the bit out into C, A becomes 0, and BNE falls through.',
    x86: { program: example(X86.examples, 'running-light'), result: leds },
    rv32: { program: example(RV32.examples, 'running-light'), result: leds },
    mos6502: { program: example(MOS6502.examples, 'running-light'), result: leds }
  }
];
