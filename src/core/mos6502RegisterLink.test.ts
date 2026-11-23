import { describe, expect, it } from 'vitest';
import { solveRegister, type RegisterRequest } from './logic/register';
import { execute } from './mos6502/execute';
import type { Instruction, Mnemonic } from './mos6502/instructions';
import type { Operand } from './mos6502/operands';
import { createCpuState, REGISTER_NAMES } from './mos6502/state';
import { mos6502RegisterLink } from './mos6502RegisterLink';
import { hasRegisters } from './registerLink';
import { snapshot } from './shared/state';

const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number): Operand => ({ type: 'zp', address, index: null });
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
  cpu.registers.a = next() & 0xff;
  cpu.registers.x = next() & 0xff;
  cpu.registers.y = next() & 0xff;
  const record = execute(cpu, instruction, from, [instruction]);
  const link = mos6502RegisterLink(record, snapshot(cpu));
  const writes = hasRegisters(link) ? link.writes : [];
  for (const name of REGISTER_NAMES) {
    if (name === 'pc') continue;
    const write = writes.find((each) => each.register === name.toUpperCase());
    const request: RegisterRequest = write?.request ?? {
      width: 8,
      held: record.before.registers[name],
      input: next() & 0xff,
      enabled: 0
    };
    expect(`${name}=${solveRegister(request).stored}`).toBe(`${name}=${cpu.registers[name]}`);
  }
  return { link, writes };
}

function agrees(instruction: Instruction, from: number | null = null) {
  const next = random(instruction.mnemonic.charCodeAt(0) * 131 + instruction.mnemonic.length);
  let last = run(instruction, from, next);
  for (let i = 0; i < 20; i++) last = run(instruction, from, next);
  return last;
}

describe('mos6502RegisterLink', () => {
  it.each([
    [line('lda', imm(0x42)), ['A']],
    [line('ldx', imm(0x80)), ['X']],
    [line('adc', imm(0x11)), ['A']],
    [line('tay'), ['Y']],
    [line('inx'), ['X']],
    [line('pha'), ['SP']],
    [line('pla'), ['A', 'SP']]
  ] as const)('$0.mnemonic: the flip-flops hold what the CPU holds', (instruction, registers) => {
    const { writes } = agrees(instruction);
    expect(writes.map((write) => write.register)).toEqual(registers);
  });

  it('shows the stack pointer a call moved, not PC', () => {
    const { writes } = agrees(line('jsr', label(0)), 0);
    expect(writes.map((write) => write.register)).toEqual(['SP']);
  });

  it('says an instruction wrote only the flags when it did', () => {
    const { link } = agrees(line('sec'));
    expect(link).toEqual({
      unavailable:
        'SEC wrote no register but P. The flags, and PC, which every instruction loads, are not shown here yet.'
    });
    expect(agrees(line('jmp', label(0)), 0).link).toEqual({
      unavailable:
        'JMP wrote no register. PC, which every instruction loads, is not shown here yet.'
    });
  });

  it.each([line('sta', zp(0x10)), line('cmp', imm(1)), line('jmp', label(0))])(
    '$mnemonic: has no register to show',
    (instruction) => {
      const { link } = agrees(instruction, 0);
      expect(hasRegisters(link)).toBe(false);
    }
  );
});
