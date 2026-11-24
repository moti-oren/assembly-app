import { describe, expect, it } from 'vitest';
import { flagAnswers, hasNumbers } from './numberLink';
import { resultOf, solveNumber } from './representation/request';
import { execute } from './rv32/execute';
import type { Instruction, Mnemonic } from './rv32/instructions';
import type { Operand } from './rv32/operands';
import { parseRegister } from './rv32/registers';
import { createCpuState, readRegister, writeRegister } from './rv32/state';
import { BRANCH_TAKEN, SET_RESULT } from './rv32AluLink';
import { rv32NumberLink } from './rv32NumberLink';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const mem = (base: string, offset: number): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const A0 = parseRegister('a0')!;

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/** Operands that sit close together now and then, so equal and nearly equal values come up. */
function operands(next: () => number): [number, number] {
  const a = next();
  const kind = next() % 4;
  if (kind === 0) return [a, a];
  if (kind === 1) return [a, (a + 1) >>> 0];
  return [a, next()];
}

function run(instruction: Instruction, a: number, b: number) {
  const cpu = createCpuState();
  writeRegister(cpu, parseRegister('a1')!, a);
  writeRegister(cpu, parseRegister('a2')!, b);
  const record = execute(cpu, instruction, null, [instruction]);
  const link = rv32NumberLink(record);
  if (!hasNumbers(link)) throw new Error(link.unavailable);
  const solution = solveNumber(link.request);
  return { cpu, record, link, solution, flags: flagAnswers(link, solution) };
}

describe('rv32NumberLink', () => {
  it.each(['add', 'sub'] as const)('%s: the numbers give the CPU’s result', (mnemonic) => {
    const next = random(mnemonic.length * 31 + mnemonic.charCodeAt(1));
    for (let i = 0; i < 80; i++) {
      const [a, b] = operands(next);
      const { cpu, solution } = run(line(mnemonic, r('a0'), r('a1'), r('a2')), a, b);
      expect(resultOf(solution)).toBe(readRegister(cpu, A0));
    }
  });

  it.each(['slt', 'sltu'] as const)('%s: rd says which is smaller on its scale', (mnemonic) => {
    const next = random(mnemonic.length);
    for (let i = 0; i < 80; i++) {
      const [a, b] = operands(next);
      const { cpu, flags } = run(line(mnemonic, r('a0'), r('a1'), r('a2')), a, b);
      expect(flags[SET_RESULT]).toBe(readRegister(cpu, A0));
    }
  });

  it.each(['slti', 'sltiu'] as const)('%s: a negative immediate is its 32 bits', (mnemonic) => {
    const next = random(mnemonic.length * 17);
    for (let i = 0; i < 80; i++) {
      const immediate = -1 - (next() % 2000);
      const { cpu, flags, link } = run(line(mnemonic, r('a0'), r('a1'), imm(immediate)), next(), 0);
      expect(link.request).toMatchObject({ b: immediate >>> 0 });
      expect(flags[SET_RESULT]).toBe(readRegister(cpu, A0));
    }
  });

  it.each(['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu'] as const)(
    '%s: whether it jumps is a comparison on its scale',
    (mnemonic) => {
      const next = random(mnemonic.charCodeAt(1) * mnemonic.length);
      for (let i = 0; i < 80; i++) {
        const [a, b] = operands(next);
        const { record, flags } = run(line(mnemonic, r('a1'), r('a2'), label(0)), a, b);
        expect(flags[BRANCH_TAKEN]).toBe(Number(record.comparison!.taken));
      }
    }
  );

  it.each([
    ['lb', 1],
    ['lbu', 1],
    ['lh', 2],
    ['lhu', 2]
  ] as const)('%s: the extension gives the register its value', (mnemonic, size) => {
    const next = random(mnemonic.charCodeAt(1) + size);
    for (let i = 0; i < 80; i++) {
      const cpu = createCpuState();
      const address = 0x1000;
      for (let byte = 0; byte < size; byte++) cpu.memory[address + byte] = next() & 0xff;
      writeRegister(cpu, parseRegister('a1')!, address);
      const instruction = line(mnemonic, r('a0'), mem('a1', 0));
      const link = rv32NumberLink(execute(cpu, instruction, null, [instruction]));
      if (!hasNumbers(link)) throw new Error(link.unavailable);
      expect(link.request).toMatchObject({ kind: 'extend', from: size * 8, to: 32 });
      expect(resultOf(solveNumber(link.request))).toBe(readRegister(cpu, A0));
    }
  });

  it('shows a whole word’s load as the sum that found its address', () => {
    const { link } = run(line('lw', r('a0'), mem('a1', 8)), 0x1000, 0);
    expect(link.request).toMatchObject({ kind: 'add', a: 0x1000, b: 8 });
  });

  it('takes a negative immediate as its 32 bits', () => {
    const { solution, link } = run(line('addi', r('a0'), r('a1'), imm(-1)), 5, 0);
    expect(link.request).toMatchObject({ b: 0xffffffff });
    expect(resultOf(solution)).toBe(4);
  });

  it.each(['sll', 'srl', 'sra'] as const)('%s: the numbers give the CPU’s result', (mnemonic) => {
    const next = random(mnemonic.charCodeAt(1) * 41 + mnemonic.charCodeAt(2));
    for (let i = 0; i < 150; i++) {
      // The count is any 32 bits: only its low five are used.
      const { cpu, solution, link } = run(
        line(mnemonic, r('a0'), r('a1'), r('a2')),
        next(),
        next()
      );
      expect(link.request).toMatchObject({ kind: 'shift' });
      expect(resultOf(solution)).toBe(readRegister(cpu, A0));
    }
  });

  it.each(['slli', 'srli', 'srai'] as const)(
    '%s: the numbers give the CPU’s result',
    (mnemonic) => {
      const next = random(mnemonic.charCodeAt(1) * 59 + mnemonic.charCodeAt(2));
      for (let i = 0; i < 150; i++) {
        const places = next() % 32;
        const { cpu, solution, link } = run(
          line(mnemonic, r('a0'), r('a1'), imm(places)),
          next(),
          0
        );
        expect(link.request).toMatchObject({ kind: 'shift', count: places });
        expect(resultOf(solution)).toBe(readRegister(cpu, A0));
      }
    }
  );

  it('has nothing to show for bitwise logic, a multiplication or an upper immediate', () => {
    const cpu = createCpuState();
    const link = (instruction: Instruction) =>
      rv32NumberLink(execute(cpu, instruction, null, [instruction]));
    expect(link(line('and', r('a0'), r('a1'), r('a2')))).toHaveProperty('unavailable');
    expect(link(line('mul', r('a0'), r('a1'), r('a2')))).toHaveProperty('unavailable');
    expect(link(line('lui', r('a0'), imm(1)))).toHaveProperty('unavailable');
  });
});
