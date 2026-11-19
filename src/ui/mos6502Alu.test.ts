import { describe, expect, it } from 'vitest';
import { execute } from '@/core/mos6502/execute';
import type { Instruction, Mnemonic } from '@/core/mos6502/instructions';
import type { Operand } from '@/core/mos6502/operands';
import { createCpuState, flagBit } from '@/core/mos6502/state';
import { aluEquation, equationText, flagReason } from './mos6502Alu';
import { messagesFor } from './locale';

const m = messagesFor('en');

const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const imm = (value: number): Operand => ({ type: 'imm', value });

function runAll(...instructions: Instruction[]) {
  const state = createCpuState();
  let record = execute(state, instructions[0], null, []);
  for (const instruction of instructions.slice(1)) record = execute(state, instruction, null, []);
  return { state, record };
}

describe('aluEquation', () => {
  it('writes ADC with its carry and SBC with its borrow', () => {
    const add = runAll(line('sec'), line('lda', imm(0x19)), line('adc', imm(0x01))).record;
    expect(equationText(m, aluEquation(m, add)!)).toBe('$19 + $01 + 1 (C) = $1B');
    const subtract = runAll(line('clc'), line('lda', imm(0x20)), line('sbc', imm(0x01))).record;
    expect(equationText(m, aluEquation(m, subtract)!)).toBe('$20 − $01 − 1 (borrow) = $1E');
  });

  it('says where the result went', () => {
    expect(aluEquation(m, runAll(line('cmp', imm(1))).record)?.destination).toBe(
      'only the flags are kept'
    );
    expect(aluEquation(m, runAll(line('inx')).record)?.destination).toBe('into X');
    const shifted = runAll(line('asl', { type: 'zp', address: 0x10, index: null })).record;
    expect(aluEquation(m, shifted)?.destination).toBe('back to $0010');
  });

  it('notes decimal mode', () => {
    const record = runAll(line('sed'), line('lda', imm(0x19)), line('adc', imm(0x01))).record;
    expect(aluEquation(m, record)?.note).toBe('decimal (BCD) digits');
  });
});

describe('flagReason', () => {
  it('explains C after a compare, unsigned', () => {
    const { record } = runAll(line('lda', imm(5)), line('cmp', imm(3)));
    expect(flagReason(m, record, 'C')).toBe('$05 ≥ $03 (unsigned)');
    expect(flagReason(m, record, 'Z')).toBe('the result $02 is not zero');
  });

  it('explains V and N from BIT by the bits of the byte', () => {
    const state = createCpuState();
    state.memory[0x20] = 0x40;
    const record = execute(
      state,
      line('bit', { type: 'zp', address: 0x20, index: null }),
      null,
      []
    );
    expect(flagReason(m, record, 'V')).toBe('bit 6 of the byte is 1');
    expect(flagReason(m, record, 'N')).toBe('bit 7 of the byte is 0');
  });

  it('explains the NMOS decimal flags', () => {
    const { record } = runAll(line('sed'), line('lda', imm(0x99)), line('adc', imm(0x01)));
    expect(flagReason(m, record, 'Z')).toContain('from the binary sum');
  });

  it('names the instruction that set a flag directly, and nothing else', () => {
    const { record } = runAll(line('sed'));
    expect(flagReason(m, record, 'D')).toBe('SED set D: ADC and SBC work in decimal');
    expect(flagReason(m, record, 'C')).toBeNull();
    const state = createCpuState();
    state.memory[0x01ff] = flagBit('C');
    state.registers.sp = 0xfe;
    expect(flagReason(m, execute(state, line('plp'), null, []), 'C')).toBe(
      'PLP pulled P from the stack'
    );
  });
});
