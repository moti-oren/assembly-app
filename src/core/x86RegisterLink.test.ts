import { describe, expect, it } from 'vitest';
import { solveRegister, type RegisterRequest } from './logic/register';
import { hasRegisters } from './registerLink';
import { snapshot } from './shared/state';
import { execute } from './x86/execute';
import type { Instruction, Mnemonic } from './x86/instructions';
import type { Operand } from './x86/operands';
import { WORD_REGISTERS, type RegisterName } from './x86/registers';
import { createCpuState } from './x86/state';
import { x86RegisterLink } from './x86RegisterLink';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

const SCRATCH = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp'] as const;

/**
 * Runs the instruction on a real CPU, then clocks the flip-flops of every register, written or
 * not, and checks each holds what the CPU's register holds.
 */
function run(instruction: Instruction, from: number | null, next: () => number) {
  const cpu = createCpuState();
  for (const name of SCRATCH) cpu.registers[name] = next() & 0xffff;
  const record = execute(cpu, instruction, from);
  const link = x86RegisterLink(record, snapshot(cpu));
  const writes = hasRegisters(link) ? link.writes : [];
  for (const word of WORD_REGISTERS) {
    if (word === 'ip') continue;
    const write = writes.find((each) => each.register === word.toUpperCase());
    // What waits at a flip-flop that is not written must not matter: it is given anything.
    const noise = next() & 0xffff;
    const request: RegisterRequest = write
      ? {
          ...write.request,
          input: (write.request.input & write.request.enabled) | (noise & ~write.request.enabled)
        }
      : { width: 16, held: record.before.registers[word], input: noise, enabled: 0 };
    expect(`${word}=${solveRegister(request).stored}`).toBe(`${word}=${cpu.registers[word]}`);
  }
  return { cpu, link, writes };
}

function agrees(instruction: Instruction, from: number | null = null) {
  const next = random(instruction.mnemonic.length * 7919 + instruction.operands.length);
  let last = run(instruction, from, next);
  for (let i = 0; i < 12; i++) last = run(instruction, from, next);
  return last;
}

describe('x86RegisterLink', () => {
  it.each([
    line('mov', reg('ax'), reg('bx')),
    line('mov', reg('si'), imm(0x1234)),
    line('add', reg('cx'), reg('dx')),
    line('inc', reg('bp')),
    line('xchg', reg('ax'), reg('bx')),
    line('mul', reg('bx')),
    line('push', reg('ax')),
    line('pop', reg('di'))
  ])('$mnemonic: the flip-flops hold what the CPU holds', (instruction) => {
    expect(agrees(instruction).writes.length).toBeGreaterThan(0);
  });

  it('writes two registers in one clock cycle when the instruction does', () => {
    const { writes } = agrees(line('xchg', reg('ax'), reg('bx')));
    expect(writes.map((write) => write.register)).toEqual(['AX', 'BX']);
  });

  it.each([
    ['al', 0x00ff],
    ['ah', 0xff00],
    ['dl', 0x00ff],
    ['ch', 0xff00]
  ] as const)('a write to %s turns on half of the word’s write lines', (name, enabled) => {
    const { link, writes } = agrees(line('mov', reg(name), imm(0x5a)));
    expect(writes).toHaveLength(1);
    expect(writes[0].request.enabled).toBe(enabled);
    expect(writes[0].part).toBe(name.toUpperCase());
    expect(hasRegisters(link) && link.note).toContain('half of');
  });

  it('says a comparison wrote only the flags, which are not shown yet', () => {
    const { link } = agrees(line('cmp', reg('ax'), reg('bx')));
    expect(link).toEqual({
      unavailable:
        'CMP wrote no register but FLAGS. The flags, and IP, which every instruction loads, are not shown here yet.'
    });
  });

  it('says the same of a jump whether or not it is taken', () => {
    const { link } = agrees(line('jmp', label(0)), 0);
    expect(link).toEqual({
      unavailable:
        'JMP wrote no register. IP, which every instruction loads, is not shown here yet.'
    });
    expect(agrees(line('nop'), 0).link).toEqual({
      unavailable:
        'NOP wrote no register. IP, which every instruction loads, is not shown here yet.'
    });
  });

  it('shows the stack pointer a call moved, not IP', () => {
    const { writes } = agrees(line('call', label(0)), 0);
    expect(writes.map((write) => write.register)).toEqual(['SP']);
  });

  it('says so when what the instruction left was not kept', () => {
    const cpu = createCpuState();
    const record = execute(cpu, line('mov', reg('ax'), imm(1)));
    expect(hasRegisters(x86RegisterLink(record, null))).toBe(false);
  });
});
