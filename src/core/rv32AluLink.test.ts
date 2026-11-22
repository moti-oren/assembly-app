import { describe, expect, it } from 'vitest';
import { flagValues, hasCircuit } from './aluLink';
import { solve } from './logic/alu';
import { execute } from './rv32/execute';
import type { Instruction, Mnemonic } from './rv32/instructions';
import type { Operand } from './rv32/operands';
import { parseRegister } from './rv32/registers';
import { createCpuState, readRegister, writeRegister } from './rv32/state';
import { BRANCH_TAKEN, rv32AluLink, SET_RESULT } from './rv32AluLink';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

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
  const link = rv32AluLink(record);
  if (!hasCircuit(link)) throw new Error(link.unavailable);
  const solution = solve(link.request);
  return { cpu, record, link, solution, flags: flagValues(link, solution) };
}

describe('rv32AluLink', () => {
  it.each(['add', 'sub', 'and', 'or', 'xor', 'sll', 'srl', 'sra'] as const)(
    '%s: the circuit gives the CPU’s result',
    (mnemonic) => {
      const next = random(mnemonic.length * 31 + mnemonic.charCodeAt(1));
      for (let i = 0; i < 80; i++) {
        const [a, b] = operands(next);
        const { cpu, solution } = run(line(mnemonic, r('a0'), r('a1'), r('a2')), a, b);
        expect(solution.result).toBe(readRegister(cpu, parseRegister('a0')!));
      }
    }
  );

  it.each(['slt', 'sltu'] as const)('%s: rd is one wire of a subtraction', (mnemonic) => {
    const next = random(mnemonic.length);
    for (let i = 0; i < 80; i++) {
      const [a, b] = operands(next);
      const { cpu, flags } = run(line(mnemonic, r('a0'), r('a1'), r('a2')), a, b);
      expect(flags[SET_RESULT]).toBe(readRegister(cpu, parseRegister('a0')!));
    }
  });

  it.each(['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu'] as const)(
    '%s: whether it jumps is one wire of a subtraction',
    (mnemonic) => {
      const next = random(mnemonic.charCodeAt(1) * mnemonic.length);
      for (let i = 0; i < 80; i++) {
        const [a, b] = operands(next);
        const { record, flags } = run(line(mnemonic, r('a1'), r('a2'), label(0)), a, b);
        expect(flags[BRANCH_TAKEN]).toBe(Number(record.comparison!.taken));
      }
    }
  );

  it('shows the adder working out a load’s address', () => {
    const { link } = run(
      line('lw', r('a0'), { type: 'mem', base: parseRegister('a1')!, offset: 8 }),
      0x10000,
      0
    );
    expect(link.request).toMatchObject({ kind: 'add', a: 0x10000, b: 8 });
  });

  it('takes an immediate as the second operand', () => {
    const { solution } = run(line('addi', r('a0'), r('a1'), imm(-1)), 5, 0);
    expect(solution.result).toBe(4);
  });

  it('switches a barrel shifter’s rows by the bits of the count', () => {
    const { link } = run(line('slli', r('a0'), r('a1'), imm(5)), 1, 0);
    expect(link.request).toMatchObject({
      kind: 'shift',
      stages: [
        { distance: 1, on: 1 },
        { distance: 2, on: 0 },
        { distance: 4, on: 1 },
        { distance: 8, on: 0 },
        { distance: 16, on: 0 }
      ]
    });
  });

  it('has no circuit for a multiplication or an instruction without the ALU', () => {
    const cpu = createCpuState();
    const link = (instruction: Instruction) =>
      rv32AluLink(execute(cpu, instruction, null, [instruction]));
    expect(link(line('mul', r('a0'), r('a1'), r('a2')))).toHaveProperty('unavailable');
    expect(link(line('lui', r('a0'), imm(1)))).toHaveProperty('unavailable');
  });
});
