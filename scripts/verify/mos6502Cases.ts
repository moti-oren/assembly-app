/**
 * Writes 6502 test cases as JSON for verify-6502.py, which checks them against py65: its
 * assembler (the encodings) and its NMOS 6502 simulator (running the encoded programs).
 * Run with `npx vite-node`.
 */
import { MOS6502 } from '../../src/core/mos6502/architecture';
import { assemble } from '../../src/core/mos6502/encode';
import {
  getSpec,
  INSTRUCTIONS,
  MNEMONICS,
  type Instruction,
  type Mnemonic
} from '../../src/core/mos6502/instructions';
import { addressOfLine } from '../../src/core/mos6502/layout';
import type { Mode, Operand } from '../../src/core/mos6502/operands';
import { flagBit } from '../../src/core/mos6502/state';
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
const int = (low: number, high: number) => low + Math.floor(next() * (high - low + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
const hex = (value: number, digits: number) => value.toString(16).padStart(digits, '0');

/** An operand for a mode. Absolute addresses stay in $0200–$04FF, clear of the code and devices. */
function operandFor(mode: Mode): Operand | null {
  const zp = int(0, 0xff);
  const abs = int(0x0200, 0x04ff);
  switch (mode) {
    case 'imp':
      return null;
    case 'acc':
      return { type: 'acc' };
    case 'imm':
      return { type: 'imm', value: int(0, 0xff) };
    case 'zp':
    case 'zpx':
    case 'zpy':
      return { type: 'zp', address: zp, index: mode === 'zp' ? null : mode === 'zpx' ? 'x' : 'y' };
    case 'abs':
    case 'abx':
    case 'aby':
      return {
        type: 'abs',
        address: abs,
        index: mode === 'abs' ? null : mode === 'abx' ? 'x' : 'y'
      };
    case 'ind':
      return { type: 'ind', address: abs };
    case 'izx':
      return { type: 'izx', address: zp };
    case 'izy':
      return { type: 'izy', address: zp };
    case 'rel':
      return { type: 'label', target: 0 };
  }
}

/** An instruction as py65's assembler writes it: branches and jumps to an absolute address. */
function py65Text(instruction: Instruction, program: readonly Instruction[]): string {
  const [operand] = instruction.operands;
  const name = instruction.mnemonic;
  if (!operand) return name;
  switch (operand.type) {
    case 'acc':
      return `${name} a`;
    case 'imm':
      return `${name} #$${hex(operand.value & 0xff, 2)}`;
    case 'zp':
      return `${name} $${hex(operand.address, 2)}${operand.index ? `,${operand.index}` : ''}`;
    case 'abs':
      return `${name} $${hex(operand.address, 4)}${operand.index ? `,${operand.index}` : ''}`;
    case 'ind':
      return `${name} ($${hex(operand.address, 4)})`;
    case 'izx':
      return `${name} ($${hex(operand.address, 2)},x)`;
    case 'izy':
      return `${name} ($${hex(operand.address, 2)}),y`;
    case 'label':
      return `${name} $${hex(addressOfLine(program, operand.target), 4)}`;
  }
}

/** Every opcode a few times over, the branches and jumps aimed at lines around them. */
function encodingCases() {
  const program: Instruction[] = [];
  for (const mnemonic of MNEMONICS) {
    for (const mode of Object.keys(INSTRUCTIONS[mnemonic].modes) as Mode[]) {
      for (let i = 0; i < 6; i++) {
        const operand =
          mnemonic === 'jmp' && mode === 'abs'
            ? { type: 'label' as const, target: 0 }
            : operandFor(mode);
        program.push({ mnemonic, operands: operand ? [operand] : [] });
      }
    }
  }
  for (const [index, instruction] of program.entries()) {
    const [operand] = instruction.operands;
    if (operand?.type === 'label')
      operand.target = Math.max(0, Math.min(program.length, index + int(-40, 40)));
  }
  const { lines } = assemble(program);
  return program
    .map((instruction, index) => ({
      text: py65Text(instruction, program),
      address: lines[index].address,
      bytes: lines[index].encoding.bytes,
      problem: lines[index].encoding.problem
    }))
    .filter((encoding) => encoding.problem === null);
}

/** Instructions that only move forward: no jumps back, no subroutines, no interrupts. */
const STRAIGHT = MNEMONICS.filter(
  (mnemonic) => !['jump', 'interrupt'].includes(getSpec(mnemonic).category) && mnemonic !== 'sed'
);

function randomProgram(length: number): Instruction[] {
  const program: Instruction[] = [];
  for (let index = 0; index < length; index++) {
    const mnemonic: Mnemonic = pick(STRAIGHT);
    const mode = pick(Object.keys(INSTRUCTIONS[mnemonic].modes) as Mode[]);
    const operand = operandFor(mode);
    if (operand?.type === 'label') operand.target = int(index + 1, Math.min(length, index + 30));
    program.push({ mnemonic, operands: operand ? [operand] : [] });
  }
  return program;
}

function executionCase(length: number) {
  const program = randomProgram(length);
  const cpu = MOS6502.createState();
  // Every zero-page byte is 2, 3 or 4, so any pointer read from it lands in $0202–$0404.
  const zeroPage = Array.from({ length: 256 }, () => int(2, 4));
  zeroPage.forEach((value, address) => (cpu.memory[address] = value));
  const data = Array.from({ length: 0x400 }, () => int(0, 0xff));
  data.forEach((value, i) => (cpu.memory[0x0200 + i] = value));
  Object.assign(cpu.registers, {
    a: int(0, 0xff),
    x: int(0, 0xff),
    y: int(0, 0xff),
    sp: int(0xc0, 0xff)
  });
  cpu.flags = (int(0, 0xff) & ~flagBit('D') & ~0x10) | 0x20;
  const initial = { ...cpu.registers, p: cpu.flags };
  const { records, error } = runToEnd(MOS6502, cpu, program);
  return {
    program: program.map((instruction) => py65Text(instruction, program)),
    bytes: assemble(program).lines.flatMap((line) => line.encoding.bytes),
    zeroPage,
    data,
    initial,
    // A run that touched a device or the code can't be compared: py65 has plain memory there.
    skip:
      error !== null ||
      records.some(
        (record) => record.access?.region !== undefined && record.access.region !== 'ram'
      ),
    final: { ...cpu.registers, p: cpu.flags },
    cycles: records.reduce((sum, record) => sum + record.cycles, 0),
    memory: [...cpu.memory.slice(0, 0x0600)]
  };
}

/** One BCD addition or subtraction with valid digits: py65 matches the NMOS chip on A and C there. */
function decimalCase() {
  const bcd = () => int(0, 9) * 16 + int(0, 9);
  const mnemonic = pick(['adc', 'sbc'] as const);
  const program: Instruction[] = [
    { mnemonic: 'sed', operands: [] },
    { mnemonic, operands: [{ type: 'imm', value: bcd() }] }
  ];
  const cpu = MOS6502.createState();
  cpu.registers.a = bcd();
  cpu.flags = next() < 0.5 ? cpu.flags | flagBit('C') : cpu.flags & ~flagBit('C');
  const initial = { ...cpu.registers, p: cpu.flags };
  runToEnd(MOS6502, cpu, program);
  return {
    program: program.map((instruction) => py65Text(instruction, program)),
    bytes: assemble(program).lines.flatMap((line) => line.encoding.bytes),
    initial,
    final: { ...cpu.registers, p: cpu.flags }
  };
}

process.stdout.write(
  JSON.stringify({
    seed,
    encodings: encodingCases(),
    executions: Array.from({ length: 300 }, () => executionCase(int(5, 40))),
    decimals: Array.from({ length: 300 }, decimalCase)
  })
);
