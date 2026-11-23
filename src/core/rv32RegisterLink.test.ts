import { describe, expect, it } from 'vitest';
import { solveRegister, type RegisterRequest } from './logic/register';
import { hasRegisters } from './registerLink';
import { execute } from './rv32/execute';
import type { Instruction, Mnemonic } from './rv32/instructions';
import { formatRegister, type Operand } from './rv32/operands';
import { parseRegister, REGISTER_KEYS } from './rv32/registers';
import { createCpuState, writeRegister } from './rv32/state';
import { rv32RegisterLink } from './rv32RegisterLink';
import { snapshot } from './shared/state';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/**
 * Runs the instruction on a real CPU, then clocks the flip-flops of every register, written or
 * not, and checks each holds what the CPU's register holds.
 */
function run(instruction: Instruction, from: number | null, next: () => number) {
  const cpu = createCpuState();
  for (const name of ['a0', 'a1', 'a2', 'ra']) writeRegister(cpu, parseRegister(name)!, next());
  const record = execute(cpu, instruction, from, [instruction]);
  const link = rv32RegisterLink(record, snapshot(cpu));
  const writes = hasRegisters(link) ? link.writes : [];
  REGISTER_KEYS.forEach((key, index) => {
    const write = writes.find((each) => each.register === formatRegister(index));
    const request: RegisterRequest = write?.request ?? {
      width: 32,
      held: record.before.registers[key],
      input: next(),
      enabled: 0
    };
    expect(`${key}=${solveRegister(request).stored}`).toBe(`${key}=${cpu.registers[key]}`);
  });
  return { link, writes };
}

function agrees(instruction: Instruction, from: number | null = null) {
  const next = random(instruction.mnemonic.length * 31 + instruction.operands.length);
  let last = run(instruction, from, next);
  for (let i = 0; i < 5; i++) last = run(instruction, from, next);
  return last;
}

describe('rv32RegisterLink', () => {
  it.each([
    line('add', r('a0'), r('a1'), r('a2')),
    line('sub', r('a1'), r('a1'), r('a2')),
    line('addi', r('a0'), r('a1'), imm(-7)),
    line('lui', r('a2'), imm(0xabcde)),
    line('sltu', r('a0'), r('a1'), r('a2'))
  ])('$mnemonic: the flip-flops hold what the CPU holds', (instruction) => {
    const { writes } = agrees(instruction);
    expect(writes).toHaveLength(1);
    expect(writes[0].request.enabled).toBe(0xffffffff);
  });

  it('shows the link register a jump wrote', () => {
    const { writes } = agrees(line('jal', r('ra'), label(0)), 0);
    expect(writes.map((write) => write.register)).toEqual(['ra']);
  });

  it('explains that x0 has no flip-flops to write', () => {
    const { link } = agrees(line('add', r('zero'), r('a1'), r('a2')));
    expect('unavailable' in link && link.unavailable).toContain('x0');
  });

  it('has nothing to show for a branch', () => {
    const { link } = agrees(line('beq', r('a1'), r('a1'), label(0)), 0);
    expect(link).toEqual({
      unavailable:
        'BEQ wrote no register. PC, which every instruction from the program loads, is shown with the control unit.'
    });
  });
});
