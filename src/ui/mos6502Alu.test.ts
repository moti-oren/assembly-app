import { describe, expect, it } from 'vitest';
import { decode } from '@/core/mos6502/decode';
import { execute } from '@/core/mos6502/execute';
import {
  INSTRUCTIONS,
  MNEMONICS,
  type Instruction,
  type Mnemonic
} from '@/core/mos6502/instructions';
import type { Operand } from '@/core/mos6502/operands';
import { createCpuState, flagBit } from '@/core/mos6502/state';
import { aluEquation, equationText, flagReason } from './mos6502Alu';

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
    expect(equationText(aluEquation(add)!)).toBe('$19 + $01 + 1 (C) = $1B');
    const subtract = runAll(line('clc'), line('lda', imm(0x20)), line('sbc', imm(0x01))).record;
    expect(equationText(aluEquation(subtract)!)).toBe('$20 − $01 − 1 (borrow) = $1E');
  });

  it('says where the result went', () => {
    expect(aluEquation(runAll(line('cmp', imm(1))).record)?.destination).toBe(
      'only the flags are kept'
    );
    expect(aluEquation(runAll(line('inx')).record)?.destination).toBe('into X');
    const shifted = runAll(line('asl', { type: 'zp', address: 0x10, index: null })).record;
    expect(aluEquation(shifted)?.destination).toBe('back to $0010');
  });

  it('notes decimal mode', () => {
    const record = runAll(line('sed'), line('lda', imm(0x19)), line('adc', imm(0x01))).record;
    expect(aluEquation(record)?.note).toBe('decimal (BCD) digits');
  });
});

describe('flagReason', () => {
  it('explains C after a compare, unsigned', () => {
    const { state, record } = runAll(line('lda', imm(5)), line('cmp', imm(3)));
    expect(flagReason(record, 'C', state)).toBe('$05 ≥ $03 (unsigned)');
    expect(flagReason(record, 'Z', state)).toBe('the result $02 is not zero');
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
    expect(flagReason(record, 'V', state)).toBe('bit 6 of the byte is 1');
    expect(flagReason(record, 'N', state)).toBe('bit 7 of the byte is 0');
  });

  it('explains the NMOS decimal flags of ADC by the decimal sum and the binary one', () => {
    const { state, record } = runAll(
      line('sed'),
      line('clc'),
      line('lda', imm(0x99)),
      line('adc', imm(0x01))
    );
    expect(flagReason(record, 'C', state)).toBe('the decimal sum passed 99');
    expect(flagReason(record, 'Z', state)).toBe(
      'in decimal mode the NMOS 6502 takes Z from the binary sum $9A'
    );
  });

  it('explains decimal SBC by its binary difference, not by ADC', () => {
    const { state, record } = runAll(
      line('sed'),
      line('clc'),
      line('lda', imm(0x00)),
      line('sbc', imm(0x99))
    );
    expect(record.alu?.result.result).toBe(0x00);
    expect(flagReason(record, 'C', state)).toBe('a borrow was needed');
    for (const flag of ['N', 'V', 'Z'] as const)
      expect(flagReason(record, flag, state)).toBe(
        'in decimal mode SBC takes N, V and Z from the binary difference $66, not from the digits'
      );
  });

  it('explains N and Z of a load or a transfer by the byte it copied', () => {
    const loaded = runAll(line('ldx', imm(0x80)));
    expect(flagReason(loaded.record, 'N', loaded.state)).toBe(
      'bit 7 of $80, the byte now in X, is 1'
    );
    const zero = runAll(line('ldx', imm(0x80)), line('lda', imm(0x00)));
    expect(flagReason(zero.record, 'Z', zero.state)).toBe('$00, the byte now in A, is zero');
    const moved = runAll(line('lda', imm(0x05)), line('tay'));
    expect(flagReason(moved.record, 'Z', moved.state)).toBe('$05, the byte now in Y, is not zero');
    expect(flagReason(moved.record, 'C', moved.state)).toBeNull();
  });

  it('has a reason for every flag any instruction writes', () => {
    const operands: Record<string, Operand[]> = {
      imp: [],
      acc: [{ type: 'acc' }],
      imm: [imm(0x80)],
      zp: [{ type: 'zp', address: 0x10, index: null }]
    };
    for (const mnemonic of MNEMONICS) {
      const mode = Object.keys(INSTRUCTIONS[mnemonic].modes).find((name) => name in operands);
      const instruction = mode && line(mnemonic, ...operands[mode]);
      // BRK and RTI jump, which a lone line cannot do; their flags are covered above.
      if (!instruction || ['brk', 'rti'].includes(mnemonic)) continue;
      if (decode(instruction).flagsWritten.length === 0) continue;
      const state = createCpuState();
      const record = execute(state, instruction, null, []);
      for (const flag of decode(instruction).flagsWritten)
        expect(flagReason(record, flag, state), `${mnemonic} ${flag}`).not.toBeNull();
    }
  });

  it('names the instruction that set a flag directly, and nothing else', () => {
    const { state: after, record } = runAll(line('sed'));
    expect(flagReason(record, 'D', after)).toBe('SED set D: ADC and SBC work in decimal');
    expect(flagReason(record, 'C', after)).toBeNull();
    const state = createCpuState();
    state.memory[0x01ff] = flagBit('C');
    state.registers.sp = 0xfe;
    expect(flagReason(execute(state, line('plp'), null, []), 'C', state)).toBe(
      'PLP pulled P from the stack'
    );
  });
});
