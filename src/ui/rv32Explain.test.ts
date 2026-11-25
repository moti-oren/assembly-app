import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { execute } from '@/core/rv32/execute';
import type { Instruction, Mnemonic } from '@/core/rv32/instructions';
import type { Operand } from '@/core/rv32/operands';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState, DATA_BASE, DEVICE_BASE, writeRegister } from '@/core/rv32/state';
import {
  aluEquation,
  aluIdleText,
  describeAccess,
  describeComparison,
  describeDecode,
  describeExecute,
  describeFetch
} from './rv32Explain';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number, base: string): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

function cpu(values: Record<string, number> = {}) {
  const state = createCpuState();
  for (const [name, value] of Object.entries(values)) {
    writeRegister(state, parseRegister(name)!, value);
  }
  return state;
}

describe('the cycle in words', () => {
  const program = [
    line('add', r('a0'), r('a1'), r('a2')),
    line('beq', r('a0'), r('zero'), label(0))
  ];

  it('fetches the word at PC and moves PC on', () => {
    expect(describeFetch(1, program)).toBe(
      'PC is 0x00000004, where L1 starts. The CPU reads the 4-byte word there, 0xFE050EE3, and PC will move on to 0x00000008: the registers on show change once the instruction has run.'
    );
  });

  it('decodes the format, the register fields and what will be read and written', () => {
    expect(describeDecode(program[0])).toBe(
      'Arithmetic, R-type: rd = rs1 + rs2. The register fields say rd = a0, rs1 = a1 and rs2 = a2. It will read a1 and a2. It will write a0.'
    );
    expect(describeDecode(line('lw', r('t0'), at(-4, 'sp')))).toContain(
      'The immediate is 0xFFFFFFFC (-4). It will read sp. It will load a word. It will write t0.'
    );
    expect(describeDecode(program[1])).toContain('Whether it jumps depends on the comparison.');
  });

  it('says what changed and where PC went', () => {
    const state = cpu({ a1: 2, a2: 3 });
    const record = execute(state, program[0], 0, program);
    expect(describeExecute(record, state, program)).toBe(
      'It changed a0. PC is at 0x00000004 (L1), the next line.'
    );
    const branch = execute(state, program[1], 1, program);
    expect(describeExecute(branch, state, program)).toBe(
      'Not taken: BEQ branches when a0 = zero, but a0 is 5 and zero is 0. PC is at 0x00000008 (L2), the next line.'
    );
  });

  it('says why a branch was taken, with the values as it compared them', () => {
    const loop = [program[0], line('bltu', r('a0'), r('a1'), label(0))];
    const state = cpu({ a0: 1, a1: -1 });
    const record = execute(state, loop[1], 1, loop);
    expect(describeExecute(record, state, loop)).toBe(
      'Taken: BLTU branches when a0 < a1, unsigned, and a0 is 1 and a1 is 4294967295. PC is now 0x00000000 (L0).'
    );
    const signed = [program[0], line('blt', r('a0'), r('a1'), label(0))];
    const again = cpu({ a0: 1, a1: -1 });
    expect(describeExecute(execute(again, signed[1], 1, signed), again, signed)).toBe(
      'Not taken: BLT branches when a0 < a1, signed, but a0 is 1 and a1 is -1. PC is at 0x00000008 (L2), the next line.'
    );
  });

  it('says an instruction from the builder ran directly', () => {
    const state = cpu({ a1: 2, a2: 3 });
    const record = execute(state, program[0], null, []);
    expect(describeExecute(record, state, [])).toBe(
      'Ran directly (not from the program). It changed a0.'
    );
  });
});

describe('aluEquation', () => {
  it('writes the sum with its destination register', () => {
    const state = cpu({ a1: 7 });
    const record = execute(state, line('addi', r('a0'), r('a1'), imm(-1)), null, []);
    expect(aluEquation(record)).toEqual({
      left: '0x00000007',
      operator: '+',
      right: '0xFFFFFFFF',
      result: '0x00000006',
      destination: 'into a0',
      note: null
    });
  });

  it('calls the sum of a load the address', () => {
    const state = cpu({ s0: DATA_BASE });
    const record = execute(state, line('lw', r('a0'), at(8, 's0')), null, []);
    expect(aluEquation(record)?.destination).toBe('the address');
  });
});

describe('describeComparison', () => {
  it('compares as the branch does: signed, unsigned or bit for bit', () => {
    const program = [line('bltu', r('a0'), r('a1'), label(1))];
    const state = cpu({ a0: 0xffffffff, a1: 1 });
    const record = execute(state, program[0], 0, program);
    expect(describeComparison(record, state, program)).toEqual({
      left: 'a0 = 4294967295',
      operator: '<',
      right: 'a1 = 1',
      how: 'as unsigned numbers',
      taken: false,
      outcome: 'false: went on to 0x00000004 (L1)'
    });
  });

  it('is null for an instruction that is not a branch', () => {
    const state = cpu();
    expect(
      describeComparison(
        execute(state, line('slt', r('a0'), r('a1'), r('a2')), null, []),
        state,
        []
      )
    ).toBeNull();
  });
});

describe('describeAccess', () => {
  it('names the device a byte went to', () => {
    const state = cpu({ s0: DEVICE_BASE, t0: 0x81 });
    const record = execute(state, line('sb', r('t0'), at(PORTS.leds, 's0')), null, []);
    expect(describeAccess(record)).toBe('Stored the byte 0x81 at 0x10000010, the LEDs');
  });

  it('says when a load read the code', () => {
    const program = [line('addi', r('a0'), r('zero'), imm(5))];
    const state = cpu();
    const record = execute(state, line('lw', r('t0'), at(0, 'zero')), null, program);
    expect(describeAccess(record)).toBe('Loaded the word 0x00500513 from 0x00000000, in the code');
  });
});

describe('aluIdleText', () => {
  it('says a branch used the ALU to compare, and anything else did not', () => {
    const beq = line('beq', r('a0'), r('a1'), label(0));
    const branch = execute(createCpuState(), beq, null, [beq]);
    expect(aluIdleText(branch)).toContain('subtracted the two registers');
    const lui = line('lui', r('a0'), imm(1));
    expect(aluIdleText(execute(createCpuState(), lui, null, [lui]))).toBe('The ALU was not used.');
  });
});

describe('aluEquation, at the edges', () => {
  it('says a result sent to x0 is thrown away', () => {
    const write = line('addi', r('zero'), r('zero'), imm(5));
    const record = execute(createCpuState(), write, null, [write]);
    expect(aluEquation(record)?.destination).toBe('thrown away: zero always reads 0');
  });

  it('says dividing by zero does not trap', () => {
    const divide = line('div', r('a5'), r('a0'), r('zero'));
    const record = execute(createCpuState(), divide, null, [divide]);
    expect(aluEquation(record)?.note).toContain('dividing by zero does not trap');
  });
});
