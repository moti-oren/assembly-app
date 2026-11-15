import { beforeEach, describe, expect, it } from 'vitest';
import { CpuError, execute, undo } from './execute';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import type { RegisterName } from './registers';
import {
  createCpuState,
  getFlag,
  physicalAddress,
  readMemory,
  readRegister,
  writeRegister,
  type CpuState
} from './state';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const byteAt = (displacement: number): Operand => ({ type: 'mem', size: 8, base: null, displacement });
const wordAt = (displacement: number): Operand => ({ type: 'mem', size: 16, base: null, displacement });

let cpu: CpuState;

function run(mnemonic: Mnemonic, ...operands: Operand[]) {
  const instruction: Instruction = { mnemonic, operands };
  return execute(cpu, instruction);
}

function flags() {
  return {
    CF: getFlag(cpu, 'CF'),
    ZF: getFlag(cpu, 'ZF'),
    SF: getFlag(cpu, 'SF'),
    OF: getFlag(cpu, 'OF')
  };
}

beforeEach(() => {
  cpu = createCpuState();
});

describe('registers', () => {
  it('8-bit registers are views into their 16-bit parent', () => {
    run('mov', reg('ax'), imm(0x1234));
    expect(readRegister(cpu, 'ah')).toBe(0x12);
    expect(readRegister(cpu, 'al')).toBe(0x34);

    run('mov', reg('al'), imm(0xff));
    expect(readRegister(cpu, 'ax')).toBe(0x12ff);

    run('mov', reg('ah'), imm(0));
    expect(readRegister(cpu, 'ax')).toBe(0x00ff);
  });

  it('negative immediates are stored in two\'s complement', () => {
    run('mov', reg('bx'), imm(-1));
    expect(readRegister(cpu, 'bx')).toBe(0xffff);
  });

  it('rejects operand combinations the 8086 does not have', () => {
    expect(() => run('mov', reg('ax'), reg('bl'))).toThrow(CpuError);
    expect(() => run('mov', reg('cs'), reg('ax'))).toThrow(CpuError);
    expect(() => run('mov', reg('al'), imm(300))).toThrow(CpuError);
    expect(() => run('mov', byteAt(0), byteAt(1))).toThrow(CpuError);
    expect(() => run('shl', reg('ax'), imm(2))).toThrow(CpuError);
  });
});

describe('add / sub flags', () => {
  it('wraps around and sets CF and ZF', () => {
    run('mov', reg('ax'), imm(0xffff));
    run('add', reg('ax'), imm(1));
    expect(readRegister(cpu, 'ax')).toBe(0);
    expect(flags()).toEqual({ CF: true, ZF: true, SF: false, OF: false });
  });

  it('sets OF on signed overflow without carry', () => {
    run('mov', reg('al'), imm(0x7f));
    run('add', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0x80);
    expect(flags()).toEqual({ CF: false, ZF: false, SF: true, OF: true });
  });

  it('sets CF on borrow', () => {
    run('mov', reg('al'), imm(1));
    run('sub', reg('al'), imm(2));
    expect(readRegister(cpu, 'al')).toBe(0xff);
    expect(flags()).toEqual({ CF: true, ZF: false, SF: true, OF: false });
  });

  it('adc and sbb use the carry', () => {
    run('stc');
    run('mov', reg('ax'), imm(5));
    run('adc', reg('ax'), imm(5));
    expect(readRegister(cpu, 'ax')).toBe(11);
    run('stc');
    run('sbb', reg('ax'), imm(1));
    expect(readRegister(cpu, 'ax')).toBe(9);
  });

  it('cmp sets flags without storing', () => {
    run('mov', reg('cx'), imm(5));
    run('cmp', reg('cx'), imm(5));
    expect(readRegister(cpu, 'cx')).toBe(5);
    expect(getFlag(cpu, 'ZF')).toBe(true);
  });

  it('sets PF from the low byte', () => {
    run('mov', reg('al'), imm(0b0000_0010));
    run('add', reg('al'), imm(1)); // 0b11: two bits set
    expect(getFlag(cpu, 'PF')).toBe(true);
    run('add', reg('al'), imm(1)); // 0b100: one bit set
    expect(getFlag(cpu, 'PF')).toBe(false);
  });
});

describe('inc / dec / neg', () => {
  it('inc and dec leave CF alone', () => {
    run('stc');
    run('mov', reg('ax'), imm(0xffff));
    run('inc', reg('ax'));
    expect(readRegister(cpu, 'ax')).toBe(0);
    expect(getFlag(cpu, 'ZF')).toBe(true);
    expect(getFlag(cpu, 'CF')).toBe(true);

    run('clc');
    run('dec', reg('ax'));
    expect(readRegister(cpu, 'ax')).toBe(0xffff);
    expect(getFlag(cpu, 'CF')).toBe(false);
  });

  it('neg sets CF unless the operand is zero', () => {
    run('mov', reg('al'), imm(5));
    run('neg', reg('al'));
    expect(readRegister(cpu, 'al')).toBe(0xfb);
    expect(getFlag(cpu, 'CF')).toBe(true);

    run('mov', reg('al'), imm(0));
    run('neg', reg('al'));
    expect(getFlag(cpu, 'CF')).toBe(false);
  });
});

describe('mul / div', () => {
  it('8-bit mul writes AX', () => {
    run('mov', reg('al'), imm(200));
    run('mov', reg('bl'), imm(2));
    run('mul', reg('bl'));
    expect(readRegister(cpu, 'ax')).toBe(400);
    expect(getFlag(cpu, 'CF')).toBe(true);
  });

  it('16-bit mul writes DX:AX', () => {
    run('mov', reg('ax'), imm(0x1000));
    run('mov', reg('bx'), imm(0x0100));
    run('mul', reg('bx'));
    expect(readRegister(cpu, 'dx')).toBe(0x0010);
    expect(readRegister(cpu, 'ax')).toBe(0x0000);
    expect(getFlag(cpu, 'OF')).toBe(true);
  });

  it('imul is signed', () => {
    run('mov', reg('al'), imm(-2));
    run('mov', reg('bl'), imm(3));
    run('imul', reg('bl'));
    expect(readRegister(cpu, 'ax')).toBe(0xfffa); // -6
    expect(getFlag(cpu, 'CF')).toBe(false);

    run('mov', reg('ax'), imm(-300));
    run('mov', reg('bx'), imm(300));
    run('imul', reg('bx'));
    // -90000 = 0xFFFE_A070
    expect(readRegister(cpu, 'dx')).toBe(0xfffe);
    expect(readRegister(cpu, 'ax')).toBe(0xa070);
    expect(getFlag(cpu, 'OF')).toBe(true);
  });

  it('div produces an integer quotient and a remainder', () => {
    run('mov', reg('ax'), imm(17));
    run('mov', reg('bl'), imm(5));
    run('div', reg('bl'));
    expect(readRegister(cpu, 'al')).toBe(3);
    expect(readRegister(cpu, 'ah')).toBe(2);

    run('mov', reg('dx'), imm(1));
    run('mov', reg('ax'), imm(0));
    run('mov', reg('bx'), imm(2));
    run('div', reg('bx'));
    expect(readRegister(cpu, 'ax')).toBe(0x8000);
    expect(readRegister(cpu, 'dx')).toBe(0);
  });

  it('idiv truncates toward zero', () => {
    run('mov', reg('ax'), imm(-7));
    run('mov', reg('bl'), imm(2));
    run('idiv', reg('bl'));
    expect(readRegister(cpu, 'al')).toBe(0xfd); // -3
    expect(readRegister(cpu, 'ah')).toBe(0xff); // -1
  });

  it('divide errors leave the state untouched', () => {
    run('mov', reg('ax'), imm(1234));
    expect(() => run('div', reg('bl'))).toThrow(/division by zero/);
    expect(readRegister(cpu, 'ax')).toBe(1234);

    run('mov', reg('bl'), imm(1));
    expect(() => run('div', reg('bl'))).toThrow(/does not fit/);
    expect(readRegister(cpu, 'ax')).toBe(1234);
  });
});

describe('logic', () => {
  it('clears CF and OF', () => {
    run('stc');
    run('mov', reg('ax'), imm(0xf0f0));
    run('and', reg('ax'), imm(0x0ff0));
    expect(readRegister(cpu, 'ax')).toBe(0x00f0);
    expect(getFlag(cpu, 'CF')).toBe(false);
  });

  it('xor reg, reg zeroes the register', () => {
    run('mov', reg('dx'), imm(0x1234));
    run('xor', reg('dx'), reg('dx'));
    expect(readRegister(cpu, 'dx')).toBe(0);
    expect(getFlag(cpu, 'ZF')).toBe(true);
  });

  it('not does not touch flags', () => {
    const before = cpu.flags;
    run('mov', reg('al'), imm(0x0f));
    run('not', reg('al'));
    expect(readRegister(cpu, 'al')).toBe(0xf0);
    expect(cpu.flags).toBe(before);
  });
});

describe('shifts and rotates', () => {
  it('shl moves the top bit into CF', () => {
    run('mov', reg('al'), imm(0x81));
    run('shl', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0x02);
    expect(getFlag(cpu, 'CF')).toBe(true);
    expect(getFlag(cpu, 'OF')).toBe(true); // sign changed
  });

  it('shifts by CL', () => {
    run('mov', reg('ax'), imm(1));
    run('mov', reg('cl'), imm(4));
    run('shl', reg('ax'), reg('cl'));
    expect(readRegister(cpu, 'ax')).toBe(16);
  });

  it('sar keeps the sign, shr does not', () => {
    run('mov', reg('al'), imm(0x80));
    run('sar', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0xc0);
    run('shr', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0x60);
  });

  it('rol and rcl', () => {
    run('mov', reg('al'), imm(0x81));
    run('rol', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0x03);
    expect(getFlag(cpu, 'CF')).toBe(true);

    run('clc');
    run('mov', reg('al'), imm(0x80));
    run('rcl', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0x00);
    expect(getFlag(cpu, 'CF')).toBe(true);
    run('rcl', reg('al'), imm(1));
    expect(readRegister(cpu, 'al')).toBe(0x01);
  });
});

describe('memory and stack', () => {
  it('memory operands are little-endian and use DS', () => {
    run('mov', reg('ax'), imm(0x1234));
    run('mov', wordAt(0x10), reg('ax'));
    const address = physicalAddress(readRegister(cpu, 'ds'), 0x10);
    expect(cpu.memory[address]).toBe(0x34);
    expect(cpu.memory[address + 1]).toBe(0x12);
    run('mov', reg('bl'), byteAt(0x11));
    expect(readRegister(cpu, 'bl')).toBe(0x12);
  });

  it('[bx] addresses through BX', () => {
    run('mov', reg('bx'), imm(0x20));
    run('mov', { type: 'mem', size: 8, base: 'bx', displacement: 0 }, imm(0x7f));
    expect(readMemory(cpu, physicalAddress(readRegister(cpu, 'ds'), 0x20), 8)).toBe(0x7f);
  });

  it('push and pop go through SS:SP', () => {
    const sp = readRegister(cpu, 'sp');
    run('mov', reg('ax'), imm(0xbeef));
    run('push', reg('ax'));
    expect(readRegister(cpu, 'sp')).toBe(sp - 2);
    expect(readMemory(cpu, physicalAddress(readRegister(cpu, 'ss'), sp - 2), 16)).toBe(0xbeef);

    run('pop', reg('cx'));
    expect(readRegister(cpu, 'cx')).toBe(0xbeef);
    expect(readRegister(cpu, 'sp')).toBe(sp);
  });

  it('xchg swaps', () => {
    writeRegister(cpu, 'ax', 1);
    writeRegister(cpu, 'bx', 2);
    run('xchg', reg('ax'), reg('bx'));
    expect(readRegister(cpu, 'ax')).toBe(2);
    expect(readRegister(cpu, 'bx')).toBe(1);
  });
});

describe('undo', () => {
  it('restores registers, flags and memory', () => {
    run('mov', reg('ax'), imm(0x1234));
    const flagsBefore = cpu.flags;
    const record = run('push', reg('ax'));
    const record2 = run('add', reg('ax'), imm(0xffff));

    undo(cpu, record2);
    expect(readRegister(cpu, 'ax')).toBe(0x1234);
    expect(cpu.flags).toBe(flagsBefore);

    undo(cpu, record);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);
    expect(readMemory(cpu, physicalAddress(readRegister(cpu, 'ss'), 0xfffc), 16)).toBe(0);
  });
});
