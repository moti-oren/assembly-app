/**
 * Writes RISC-V test cases as JSON for verify-rv32.py, which checks them against Capstone (the
 * encodings) and Unicorn (running the encoded programs). Run with `npx vite-node`.
 */
import { assemble } from '../../src/core/rv32/encode';
import { RV32 } from '../../src/core/rv32/architecture';
import {
  formatInstruction,
  getSpec,
  MNEMONICS,
  type Instruction,
  type Mnemonic
} from '../../src/core/rv32/instructions';
import type { Operand, OperandKind } from '../../src/core/rv32/operands';
import { DATA_BASE, readRegister } from '../../src/core/rv32/state';
import { runToEnd } from '../../src/core/shared/program';

/** A small seeded generator (mulberry32), so a failing case can be produced again. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const seed = Number(process.argv[2] ?? 1);
const next = random(seed);
const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
const int = (low: number, high: number) => low + Math.floor(next() * (high - low + 1));

const DATA_REGISTER = 8; // s0 holds DATA_BASE in the execution cases and is never written
const reg = (index: number): Operand => ({ type: 'reg', index });
const imm = (value: number): Operand => ({ type: 'imm', value });

const IMM12 = [-2048, -1, 0, 1, 5, 10, 0x7ff, 0x123, -0x123];
const SHAMT = [0, 1, 15, 31];
const IMM20 = [0, 1, 0x12345, 0x80000, 0xfffff];

function operandFor(kind: OperandKind, writable: boolean): Operand {
  switch (kind) {
    case 'reg':
      return reg(
        writable ? pick([...Array(32).keys()].filter((i) => i !== DATA_REGISTER)) : int(0, 31)
      );
    case 'imm12':
      return imm(next() < 0.5 ? pick(IMM12) : int(-2048, 2047));
    case 'shamt':
      return imm(next() < 0.5 ? pick(SHAMT) : int(0, 31));
    case 'imm20':
      return imm(next() < 0.5 ? pick(IMM20) : int(0, 0xfffff));
    case 'mem':
      return {
        type: 'mem',
        base: int(0, 31),
        offset: next() < 0.5 ? pick(IMM12) : int(-2048, 2047)
      };
    case 'label':
      return { type: 'label', target: 0 };
  }
}

/** Every mnemonic with varied operands, each line branching to a varied line of the program. */
function encodingCases(): {
  text: string;
  mnemonic: Mnemonic;
  word: number;
  distance: number | null;
}[] {
  const program: Instruction[] = [];
  for (const mnemonic of MNEMONICS) {
    for (let i = 0; i < 40; i++) {
      const { form } = getSpec(mnemonic);
      program.push({ mnemonic, operands: form.map((kind, n) => operandFor(kind, n === 0)) });
    }
  }
  for (const [index, instruction] of program.entries()) {
    for (const operand of instruction.operands) {
      if (operand.type === 'label')
        operand.target = Math.max(0, Math.min(program.length, index + int(-500, 500)));
    }
  }
  const { lines } = assemble(program);
  return program.map((instruction, index) => {
    const label = instruction.operands.find((operand) => operand.type === 'label');
    return {
      text: formatInstruction(instruction),
      mnemonic: instruction.mnemonic,
      word: lines[index].encoding.word,
      distance: label ? (label.target - index) * 4 : null
    };
  });
}

const STRAIGHT: Mnemonic[] = MNEMONICS.filter(
  (m) => !['branch', 'jump'].includes(getSpec(m).category)
);
const ALIGN: Partial<Record<Mnemonic, number>> = { lh: 2, lhu: 2, sh: 2, lw: 4, sw: 4 };

/** A random program that only goes forward, so it always reaches its end. */
function randomProgram(length: number): Instruction[] {
  const program: Instruction[] = [];
  for (let index = 0; index < length; index++) {
    const branching = next() < 0.2;
    const mnemonic: Mnemonic = branching
      ? pick(['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu', 'jal'] as const)
      : pick(STRAIGHT);
    const { form, category } = getSpec(mnemonic);
    const operands = form.map((kind, n) => {
      const operand = operandFor(kind, n === 0 && category !== 'store');
      if (operand.type === 'mem') {
        const size = ALIGN[mnemonic] ?? 1;
        return {
          type: 'mem',
          base: DATA_REGISTER,
          offset: Math.floor(int(-2048, 2044) / size) * size
        } as Operand;
      }
      if (operand.type === 'label')
        return { type: 'label', target: int(index + 1, length) } as Operand;
      return operand;
    });
    program.push({ mnemonic, operands });
  }
  return program;
}

function executionCase(length: number) {
  const program = randomProgram(length);
  const cpu = RV32.createState();
  const initial = [0];
  for (let i = 1; i < 32; i++) {
    const value =
      i === DATA_REGISTER
        ? DATA_BASE
        : pick([0, 1, 0xffffffff, 0x80000000, 0x7fffffff, int(0, 0xffffffff)]);
    cpu.registers[`x${i}` as 'x1'] = value >>> 0;
    initial.push(value >>> 0);
  }
  const { error } = runToEnd(RV32, cpu, program);
  return {
    program: program.map(formatInstruction),
    words: assemble(program).lines.map((line) => line.encoding.word),
    initial,
    error: error?.message ?? null,
    final: [...Array(32).keys()].map((i) => readRegister(cpu, i)),
    pc: cpu.registers.pc,
    window: {
      start: DATA_BASE - 0x800,
      bytes: [...cpu.memory.slice(DATA_BASE - 0x800, DATA_BASE + 0x800)]
    }
  };
}

const cases = {
  seed,
  encodings: encodingCases(),
  executions: Array.from({ length: 300 }, () => executionCase(int(5, 40)))
};

process.stdout.write(JSON.stringify(cases));
