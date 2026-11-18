import { beforeEach, describe, expect, it } from 'vitest';
import { execute } from './execute';
import { explainFlag } from './flagReasons';
import { FLAG_NAMES } from './flags';
import type { Mnemonic } from './instructions';
import type { Operand } from './operands';
import type { RegisterName } from './registers';
import { createCpuState, getFlag, setFlag, writeRegister, type CpuState } from './state';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });

let cpu: CpuState;

function run(mnemonic: Mnemonic, ...operands: Operand[]) {
  return execute(cpu, { mnemonic, operands });
}

/** Runs an instruction and checks every flag's explanation against the flag itself. */
function check(mnemonic: Mnemonic, value: number, ...operands: Operand[]): void {
  const before = { ...cpu };
  const record = run(mnemonic, ...operands);
  for (const flag of FLAG_NAMES) {
    const reason = explainFlag(record, flag);
    const expected = reason.value ?? getFlag(before, flag);
    expect(getFlag(cpu, flag), `${mnemonic} ${value.toString(16)} ${flag}`).toBe(expected);
  }
}

beforeEach(() => {
  cpu = createCpuState();
});

describe('explainFlag', () => {
  it('explains a signed overflow without a carry', () => {
    writeRegister(cpu, 'al', 0x7f);
    const record = run('add', reg('al'), imm(1));

    expect(explainFlag(record, 'OF')).toEqual({
      value: true,
      text: 'As signed numbers 127 + 1 = 128, outside −128…127: the result 80h reads as −128.'
    });
    expect(explainFlag(record, 'CF')).toEqual({
      value: false,
      text: '7Fh + 01h = 80h fits in 8 bits, so nothing is carried out.'
    });
    expect(explainFlag(record, 'AF').text).toBe('Low digits: Fh + 1h = 10h, a carry out of bit 3.');
    expect(explainFlag(record, 'SF').value).toBe(true);
    expect(explainFlag(record, 'ZF').text).toBe('The result 80h is not zero.');
  });

  it('explains a carry out of a 16-bit sum', () => {
    writeRegister(cpu, 'ax', 0xffff);
    const record = run('add', reg('ax'), imm(1));

    expect(explainFlag(record, 'CF')).toEqual({
      value: true,
      text: 'FFFFh + 0001h = 10000h needs more than 16 bits: the carry out of bit 15 goes into CF.'
    });
    expect(explainFlag(record, 'OF').text).toBe(
      'As signed numbers (−1) + 1 = 0, which fits in −32768…32767.'
    );
    expect(explainFlag(record, 'ZF')).toEqual({ value: true, text: 'The result 0000h is zero.' });
  });

  it('explains a borrow, including the carry going into SBB', () => {
    writeRegister(cpu, 'al', 5);
    const cmp = run('cmp', reg('al'), imm(10));
    expect(explainFlag(cmp, 'CF')).toEqual({
      value: true,
      text: '05h − 0Ah needs a borrow: as unsigned numbers 5 is less than 10.'
    });

    const sbb = run('sbb', reg('al'), imm(5));
    expect(explainFlag(sbb, 'CF').text).toBe(
      '05h − 05h − 1 (CF) needs a borrow: as unsigned numbers 5 is less than 6.'
    );
  });

  it('says that INC and DEC keep CF', () => {
    setFlag(cpu, 'CF', true);
    writeRegister(cpu, 'al', 0xff);
    const record = run('inc', reg('al'));

    expect(explainFlag(record, 'CF')).toEqual({ value: null, text: 'INC never changes CF.' });
    expect(getFlag(cpu, 'CF')).toBe(true);
  });

  it('counts the one bits of the low byte for PF', () => {
    writeRegister(cpu, 'ax', 0x0100);
    const record = run('add', reg('ax'), imm(3));
    expect(explainFlag(record, 'PF')).toEqual({
      value: true,
      text: 'Only the low byte counts: 0000 0011 has 2 one bits, an even number.'
    });
  });

  it('explains the carry and overflow of a shift by 1', () => {
    writeRegister(cpu, 'al', 0x40);
    const record = run('shl', reg('al'), imm(1));

    expect(explainFlag(record, 'CF').text).toBe(
      'CF takes the last bit pushed out of the top of 40h: 0.'
    );
    expect(explainFlag(record, 'OF')).toEqual({
      value: true,
      text: 'The top bit went from 0 to 1: the sign changed.'
    });
  });

  it('leaves OF alone for a shift by more than 1, and everything for a count of 0', () => {
    writeRegister(cpu, 'al', 0x81);
    writeRegister(cpu, 'cl', 2);
    expect(explainFlag(run('shr', reg('al'), reg('cl')), 'OF').value).toBeNull();

    writeRegister(cpu, 'cl', 0);
    const nothing = run('shr', reg('al'), reg('cl'));
    expect(nothing.alu).toBeNull();
    expect(explainFlag(nothing, 'CF')).toEqual({
      value: null,
      text: 'A count of 0 changes nothing, the flags included.'
    });
  });

  it('explains when a product spills into the upper half', () => {
    writeRegister(cpu, 'al', 0x10);
    writeRegister(cpu, 'bl', 0x10);
    const record = run('mul', reg('bl'));

    expect(explainFlag(record, 'CF')).toEqual({
      value: true,
      text: 'The product 100h does not fit in AL: AH is not zero.'
    });
    expect(explainFlag(record, 'ZF').value).toBeNull();
  });

  it('explains flag-control instructions and instructions without flags', () => {
    expect(explainFlag(run('stc'), 'CF')).toEqual({ value: true, text: 'STC sets CF.' });
    expect(explainFlag(run('cmc'), 'CF')).toEqual({ value: false, text: 'CMC flips CF.' });
    expect(explainFlag(run('std'), 'CF')).toEqual({ value: null, text: 'STD only changes DF.' });
    expect(explainFlag(run('mov', reg('ax'), imm(1)), 'ZF')).toEqual({
      value: null,
      text: 'MOV does not change the flags.'
    });
  });

  it('explains the flags an interrupt clears and the ones POPF loads', () => {
    cpu.memory[0x21 * 4] = 5;
    run('sti');
    const enter = run('int', imm(0x21));
    expect(explainFlag(enter, 'IF').value).toBe(false);
    expect(explainFlag(enter, 'CF')).toEqual({
      value: null,
      text: 'INT does not change the flags.'
    });

    run('stc');
    run('pushf');
    run('clc');
    expect(explainFlag(run('popf'), 'CF')).toEqual({
      value: true,
      text: 'POPF loads every flag from the FLAGS word it pops off the stack.'
    });
  });

  it('never disagrees with the flags the CPU actually computed', () => {
    const cases: [Mnemonic, number, number][] = [];
    const values = [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0xff, 0x7fff, 0x8000, 0xffff];
    const binary: Mnemonic[] = ['add', 'adc', 'sub', 'sbb', 'cmp', 'and', 'or', 'xor', 'test'];
    for (const mnemonic of binary) {
      for (const a of values) for (const b of values) cases.push([mnemonic, a, b]);
    }

    for (const size of [8, 16] as const) {
      const [dst, src]: RegisterName[] = size === 8 ? ['al', 'bl'] : ['ax', 'bx'];
      for (const carryIn of [false, true]) {
        for (const [mnemonic, a, b] of cases) {
          cpu = createCpuState();
          setFlag(cpu, 'CF', carryIn);
          writeRegister(cpu, dst, a);
          writeRegister(cpu, src, b);
          check(mnemonic, a, reg(dst), reg(src));
        }
      }
    }
  });

  it('agrees with the CPU for unary instructions, shifts, rotates and products', () => {
    const unary: Mnemonic[] = ['inc', 'dec', 'neg', 'mul', 'imul'];
    const shifts: Mnemonic[] = ['shl', 'shr', 'sar', 'rol', 'ror', 'rcl', 'rcr'];
    const values = [0x00, 0x01, 0x40, 0x7f, 0x80, 0x81, 0xc0, 0xff, 0x4000, 0x8001, 0xffff];

    for (const target of ['bl', 'bx'] as const) {
      for (const carryIn of [false, true]) {
        for (const value of values) {
          for (const mnemonic of unary) {
            cpu = createCpuState();
            setFlag(cpu, 'CF', carryIn);
            writeRegister(cpu, 'ax', 0x1234);
            writeRegister(cpu, target, value);
            check(mnemonic, value, reg(target));
          }
          for (const mnemonic of shifts) {
            for (const count of [0, 1, 3]) {
              cpu = createCpuState();
              setFlag(cpu, 'CF', carryIn);
              writeRegister(cpu, target, value);
              writeRegister(cpu, 'cl', count);
              check(mnemonic, value, reg(target), reg('cl'));
            }
          }
        }
      }
    }
  });
});
