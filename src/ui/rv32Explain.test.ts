import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { execute } from '@/core/rv32/execute';
import type { Instruction, Mnemonic } from '@/core/rv32/instructions';
import type { Operand } from '@/core/rv32/operands';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState, DATA_BASE, DEVICE_BASE, writeRegister } from '@/core/rv32/state';
import { messagesFor } from './locale';
import {
  aluEquation,
  describeAccess,
  describeComparison,
  describeDecode,
  describeExecute,
  describeFetch
} from './rv32Explain';

const m = messagesFor('en');

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
    expect(describeFetch(m, 1, program)).toBe(
      'PC is 0x00000004, where L1 starts. The CPU reads the 4-byte word there, 0xFE050EE3, and PC moves on to 0x00000008 before anything runs.'
    );
  });

  it('decodes the format, the register fields and what will be read and written', () => {
    expect(describeDecode(m, program[0])).toBe(
      'Arithmetic, R-type: rd = rs1 + rs2. The register fields say rd = a0, rs1 = a1 and rs2 = a2. It will read a1 and a2. It will write a0.'
    );
    expect(describeDecode(m, line('lw', r('t0'), at(-4, 'sp')))).toContain(
      'The immediate is 0xFFFFFFFC (-4). It will read sp. It will load a word. It will write t0.'
    );
    expect(describeDecode(m, program[1])).toContain('Whether it jumps depends on the comparison.');
  });

  it('says what changed and where PC went', () => {
    const state = cpu({ a1: 2, a2: 3 });
    const record = execute(state, program[0], 0, program);
    expect(describeExecute(m, record, state, program)).toBe(
      'It changed a0. PC is at 0x00000004 (L1), the next line.'
    );
    const branch = execute(state, program[1], 1, program);
    expect(describeExecute(m, branch, state, program)).toBe(
      'It changed no register or memory. PC is at 0x00000008 (L2), the next line.'
    );
  });
});

describe('aluEquation', () => {
  it('writes the sum with its destination register', () => {
    const state = cpu({ a1: 7 });
    const record = execute(state, line('addi', r('a0'), r('a1'), imm(-1)), null, []);
    expect(aluEquation(m, record)).toEqual({
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
    expect(aluEquation(m, record)?.destination).toBe('the address');
  });
});

describe('describeComparison', () => {
  it('compares as the branch does: signed, unsigned or bit for bit', () => {
    const program = [line('bltu', r('a0'), r('a1'), label(1))];
    const state = cpu({ a0: 0xffffffff, a1: 1 });
    const record = execute(state, program[0], 0, program);
    expect(describeComparison(m, record, state, program)).toEqual({
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
        m,
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
    expect(describeAccess(m, record)).toBe('Stored the byte 0x81 at 0x10000010, the LEDs');
  });

  it('says when a load read the code', () => {
    const program = [line('addi', r('a0'), r('zero'), imm(5))];
    const state = cpu();
    const record = execute(state, line('lw', r('t0'), at(0, 'zero')), null, program);
    expect(describeAccess(m, record)).toBe(
      'Loaded the word 0x00500513 from 0x00000000, in the code'
    );
  });
});
