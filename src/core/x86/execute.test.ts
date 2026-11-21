import { beforeEach, describe, expect, it } from 'vitest';
import { PORTS, terminalText } from '../shared/devices';
import { CpuError } from '../shared/cpuError';
import { execute } from './execute';
import { redo, undo } from '../shared/executionRecord';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import type { RegisterName } from './registers';
import {
  createCpuState,
  getFlag,
  physicalAddress,
  readRegister,
  setFlag,
  writeRegister,
  type CpuState
} from './state';
import { readMemory, setInputPort, snapshot, writeMemory } from '../shared/state';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const byteAt = (displacement: number): Operand => ({
  type: 'mem',
  size: 8,
  base: null,
  displacement
});
const wordAt = (displacement: number): Operand => ({
  type: 'mem',
  size: 16,
  base: null,
  displacement
});

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

  it("negative immediates are stored in two's complement", () => {
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

  it('idiv rejects the most negative quotient, as the 8086 does', () => {
    run('mov', reg('ax'), imm(-128));
    run('mov', reg('bl'), imm(1));
    expect(() => run('idiv', reg('bl'))).toThrow(/quotient -128 is too big for AL/);
    expect(readRegister(cpu, 'ax')).toBe(0xff80);

    run('mov', reg('ax'), imm(-127));
    run('idiv', reg('bl'));
    expect(readRegister(cpu, 'al')).toBe(0x81);

    run('mov', reg('dx'), imm(0xffff));
    run('mov', reg('ax'), imm(0x8000));
    run('mov', reg('bx'), imm(1));
    expect(() => run('idiv', reg('bx'))).toThrow(/quotient -32768 is too big for AX/);
    expect(readRegister(cpu, 'ax')).toBe(0x8000);
  });

  it('divide errors leave the state untouched', () => {
    run('mov', reg('ax'), imm(1234));
    expect(() => run('div', reg('bl'))).toThrow(/divisor is 0/);
    expect(readRegister(cpu, 'ax')).toBe(1234);

    run('mov', reg('bl'), imm(1));
    expect(() => run('div', reg('bl'))).toThrow(/quotient 1234 is too big for AL/);
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

  it('push sp stores the SP after the decrement, as the 8086 does', () => {
    const sp = readRegister(cpu, 'sp');
    run('push', reg('sp'));
    expect(readRegister(cpu, 'sp')).toBe(sp - 2);
    expect(readMemory(cpu, physicalAddress(readRegister(cpu, 'ss'), sp - 2), 16)).toBe(sp - 2);
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

  it('redo puts back exactly what undo took away', () => {
    run('mov', reg('ax'), imm(0x41));
    const record = run('push', reg('ax'));
    const portRecord = run('out', imm(PORTS.terminal), reg('al'));
    const after = snapshot(cpu);
    const memoryAfter = cpu.memory.slice();

    undo(cpu, portRecord);
    undo(cpu, record);
    const version = cpu.memoryVersion;
    redo(cpu, record, after);
    redo(cpu, portRecord, after);

    expect(snapshot(cpu)).toEqual(after);
    expect(cpu.memory).toEqual(memoryAfter);
    expect(cpu.memoryVersion).toBeGreaterThan(version);
    expect(cpu.io.out[PORTS.terminal]).toBe(0x41);
    expect(terminalText(cpu.io.terminal)).toBe('A');
  });
});

describe('string instructions', () => {
  /** DS and ES both start at 1000h, so offsets below address the same segment. */
  const data = (offset: number) => physicalAddress(0x1000, offset);
  const bytes = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => cpu.memory[data(offset + i)]);
  const repeated = (prefix: 'rep' | 'repe' | 'repne', mnemonic: Mnemonic) =>
    execute(cpu, { prefix, mnemonic, operands: [] });

  it('movsb copies DS:SI to ES:DI and steps both up', () => {
    writeMemory(cpu, data(0x10), 8, 0xab);
    writeRegister(cpu, 'si', 0x10);
    writeRegister(cpu, 'di', 0x20);
    run('movsb');
    expect(cpu.memory[data(0x20)]).toBe(0xab);
    expect(readRegister(cpu, 'si')).toBe(0x11);
    expect(readRegister(cpu, 'di')).toBe(0x21);
  });

  it('word forms step by 2, and DF = 1 steps down', () => {
    writeRegister(cpu, 'ax', 0x1234);
    writeRegister(cpu, 'di', 0x30);
    run('stosw');
    expect(readMemory(cpu, data(0x30), 16)).toBe(0x1234);
    expect(readRegister(cpu, 'di')).toBe(0x32);

    run('std');
    run('stosw');
    expect(readMemory(cpu, data(0x32), 16)).toBe(0x1234);
    expect(readRegister(cpu, 'di')).toBe(0x30);
  });

  it('uses ES for the destination and DS for the source', () => {
    writeRegister(cpu, 'es', 0x3000);
    writeRegister(cpu, 'al', 0x7e);
    run('stosb');
    expect(cpu.memory[physicalAddress(0x3000, 0)]).toBe(0x7e);
    expect(cpu.memory[data(0)]).toBe(0);
  });

  it('lodsb loads AL from DS:SI and leaves DI alone', () => {
    writeMemory(cpu, data(5), 8, 0x99);
    writeRegister(cpu, 'si', 5);
    writeRegister(cpu, 'di', 0x40);
    run('lodsb');
    expect(readRegister(cpu, 'al')).toBe(0x99);
    expect(readRegister(cpu, 'si')).toBe(6);
    expect(readRegister(cpu, 'di')).toBe(0x40);
  });

  it('scasb and cmpsb set the flags like CMP and store nothing', () => {
    writeMemory(cpu, data(0), 8, 5);
    writeRegister(cpu, 'al', 5);
    const scan = run('scasb');
    expect(flags()).toMatchObject({ ZF: true, CF: false });
    expect(scan.memoryWrites).toHaveLength(0);
    expect(readRegister(cpu, 'di')).toBe(1);

    writeMemory(cpu, data(0x10), 8, 1);
    writeMemory(cpu, data(0x20), 8, 2);
    writeRegister(cpu, 'si', 0x10);
    writeRegister(cpu, 'di', 0x20);
    run('cmpsb');
    expect(flags()).toMatchObject({ ZF: false, CF: true, SF: true });
  });

  it('rep stosb fills CX bytes and leaves CX at 0 without touching the flags', () => {
    writeRegister(cpu, 'al', 0x2a);
    writeRegister(cpu, 'cx', 4);
    setFlag(cpu, 'ZF', true);
    const flagsBefore = cpu.flags;
    repeated('rep', 'stosb');
    expect(bytes(0, 5)).toEqual([0x2a, 0x2a, 0x2a, 0x2a, 0]);
    expect(readRegister(cpu, 'cx')).toBe(0);
    expect(readRegister(cpu, 'di')).toBe(4);
    expect(cpu.flags).toBe(flagsBefore);
  });

  it('a repeat with CX = 0 does nothing at all', () => {
    writeRegister(cpu, 'al', 0xff);
    const record = repeated('rep', 'stosb');
    expect(record.memoryWrites).toHaveLength(0);
    expect(readRegister(cpu, 'di')).toBe(0);
    expect(record.alu).toBeNull();
  });

  it('repne scasb stops on the first match, with DI one past it', () => {
    [0x61, 0x62, 0x63, 0x64].forEach((value, i) => writeMemory(cpu, data(i), 8, value));
    writeRegister(cpu, 'al', 0x63);
    writeRegister(cpu, 'cx', 10);
    repeated('repne', 'scasb');
    expect(getFlag(cpu, 'ZF')).toBe(true);
    expect(readRegister(cpu, 'di')).toBe(3);
    expect(readRegister(cpu, 'cx')).toBe(7);
  });

  it('repe cmpsb stops on the first difference, or when CX runs out', () => {
    [1, 2, 3].forEach((value, i) => writeMemory(cpu, data(i), 8, value));
    [1, 2, 9].forEach((value, i) => writeMemory(cpu, data(0x10 + i), 8, value));
    writeRegister(cpu, 'di', 0x10);
    writeRegister(cpu, 'cx', 3);
    repeated('repe', 'cmpsb');
    expect(getFlag(cpu, 'ZF')).toBe(false);
    expect(readRegister(cpu, 'cx')).toBe(0);

    writeRegister(cpu, 'si', 0);
    writeRegister(cpu, 'di', 0x10);
    writeRegister(cpu, 'cx', 2);
    repeated('repe', 'cmpsb');
    expect(getFlag(cpu, 'ZF')).toBe(true);
    expect(readRegister(cpu, 'cx')).toBe(0);
  });

  it('repe cmpsb that stops early leaves the uncounted rest in CX', () => {
    [1, 7, 3, 4].forEach((value, i) => writeMemory(cpu, data(i), 8, value));
    [1, 2, 3, 4].forEach((value, i) => writeMemory(cpu, data(0x10 + i), 8, value));
    writeRegister(cpu, 'di', 0x10);
    writeRegister(cpu, 'cx', 4);
    repeated('repe', 'cmpsb');
    expect(getFlag(cpu, 'ZF')).toBe(false);
    expect(readRegister(cpu, 'cx')).toBe(2);
    expect(readRegister(cpu, 'si')).toBe(2);
  });

  it('rep stosb with CX = FFFFh writes 65535 bytes and ends with CX at 0', () => {
    writeRegister(cpu, 'al', 0x11);
    writeRegister(cpu, 'cx', 0xffff);
    const record = repeated('rep', 'stosb');
    expect(record.memoryWrites).toHaveLength(0xffff);
    expect(readRegister(cpu, 'cx')).toBe(0);
    expect(readRegister(cpu, 'di')).toBe(0xffff);
  });

  it('undoes every byte a repeat wrote', () => {
    writeMemory(cpu, data(1), 8, 0x55);
    writeRegister(cpu, 'al', 0x2a);
    writeRegister(cpu, 'cx', 3);
    const record = repeated('rep', 'stosb');
    undo(cpu, record);
    expect(bytes(0, 3)).toEqual([0, 0x55, 0]);
    expect(readRegister(cpu, 'cx')).toBe(3);
    expect(readRegister(cpu, 'di')).toBe(0);
  });

  it('rejects a prefix on an instruction it does not fit', () => {
    expect(() => execute(cpu, { prefix: 'rep', mnemonic: 'nop', operands: [] })).toThrow(CpuError);
    expect(() => repeated('rep', 'cmpsb')).toThrow(CpuError);
    expect(() => repeated('repe', 'movsb')).toThrow(CpuError);
  });
});

describe('i/o ports', () => {
  it('out latches AL into a port chosen by number or by DX', () => {
    writeRegister(cpu, 'al', 0xa5);
    const record = run('out', imm(PORTS.leds), reg('al'));
    expect(cpu.io.out[PORTS.leds]).toBe(0xa5);
    expect(record.portWrites).toEqual([{ port: PORTS.leds, before: 0, after: 0xa5 }]);

    writeRegister(cpu, 'dx', 0x1234);
    run('out', reg('dx'), reg('al'));
    expect(cpu.io.out[0x1234]).toBe(0xa5);
  });

  it('out with AX writes two neighbouring ports, low byte first', () => {
    writeRegister(cpu, 'ax', 0x5b3f);
    run('out', imm(PORTS.digits), reg('ax'));
    expect(cpu.io.out[PORTS.digits]).toBe(0x3f);
    expect(cpu.io.out[PORTS.digits + 1]).toBe(0x5b);
  });

  it('in reads what a device presents, not what was written to the port', () => {
    setInputPort(cpu, PORTS.switches, 0x81);
    writeRegister(cpu, 'ax', 0xff00);
    run('out', imm(PORTS.switches), reg('al'));
    run('in', reg('al'), imm(PORTS.switches));
    expect(readRegister(cpu, 'ax')).toBe(0xff81);

    setInputPort(cpu, 0x300, 0x34);
    setInputPort(cpu, 0x301, 0x12);
    writeRegister(cpu, 'dx', 0x300);
    run('in', reg('ax'), reg('dx'));
    expect(readRegister(cpu, 'ax')).toBe(0x1234);
  });

  it('leaves the flags alone', () => {
    setFlag(cpu, 'CF', true);
    const flagsBefore = cpu.flags;
    run('in', reg('al'), imm(PORTS.switches));
    run('out', imm(PORTS.leds), reg('al'));
    expect(cpu.flags).toBe(flagsBefore);
  });

  it('prints every byte written to the terminal port, and unprints on undo', () => {
    const records = [0x48, 0x49].map((character) => {
      writeRegister(cpu, 'al', character);
      return run('out', imm(PORTS.terminal), reg('al'));
    });
    expect(terminalText(cpu.io.terminal)).toBe('HI');

    undo(cpu, records[1]);
    expect(terminalText(cpu.io.terminal)).toBe('H');
    expect(cpu.io.out[PORTS.terminal]).toBe(0x48);
  });

  it('undo restores a port to the byte it held before', () => {
    writeRegister(cpu, 'al', 1);
    run('out', imm(PORTS.leds), reg('al'));
    writeRegister(cpu, 'ax', 0xffff);
    const record = run('out', imm(PORTS.leds), reg('ax'));
    undo(cpu, record);
    expect(cpu.io.out[PORTS.leds]).toBe(1);
    expect(cpu.io.out[PORTS.leds + 1]).toBe(0);
  });

  it('accepts only AL or AX as data and only a byte or DX as the port', () => {
    expect(() => run('in', reg('bl'), imm(1))).toThrow(CpuError);
    expect(() => run('out', reg('bx'), reg('al'))).toThrow(CpuError);
    expect(() => run('out', imm(0x100), reg('al'))).toThrow(CpuError);
  });
});

describe('interrupts', () => {
  const label = (target: number): Operand => ({ type: 'label', target });
  /** Vectors live in segment 0, so the default DS cannot reach them through a memory operand. */
  const install = (type: number, line: number, cs = 0) => {
    writeMemory(cpu, type * 4, 16, line);
    writeMemory(cpu, type * 4 + 2, 16, cs);
  };
  const stackWord = (offset: number) => readMemory(cpu, physicalAddress(0x2000, offset), 16);

  it('int pushes FLAGS, CS and IP, clears IF and TF, and loads CS:IP from the vector', () => {
    install(0x21, 7, 0x0100);
    run('sti');
    setFlag(cpu, 'CF', true);
    const flagsBefore = cpu.flags;
    const record = execute(cpu, { mnemonic: 'int', operands: [imm(0x21)] }, 3);

    expect(readRegister(cpu, 'ip')).toBe(7);
    expect(readRegister(cpu, 'cs')).toBe(0x0100);
    expect(readRegister(cpu, 'sp')).toBe(0xfff8);
    expect(stackWord(0xfffc)).toBe(flagsBefore);
    expect(stackWord(0xfffa)).toBe(0);
    expect(stackWord(0xfff8)).toBe(4);
    expect(getFlag(cpu, 'IF')).toBe(false);
    expect(getFlag(cpu, 'CF')).toBe(true);
    expect(record.interrupt).toBe(0x21);
  });

  it('iret returns to the line after the int with the flags as they were', () => {
    install(0x21, 7, 0x0100);
    run('sti');
    const flagsBefore = cpu.flags;
    execute(cpu, { mnemonic: 'int', operands: [imm(0x21)] }, 3);
    run('stc');
    run('iret');

    expect(readRegister(cpu, 'ip')).toBe(4);
    expect(readRegister(cpu, 'cs')).toBe(0);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);
    expect(cpu.flags).toBe(flagsBefore);
  });

  it('refuses an interrupt whose vector is empty and changes nothing', () => {
    const sp = readRegister(cpu, 'sp');
    expect(() => run('int', imm(5))).toThrow(
      'INT 05h has no handler yet: its vector at 0000:0014 is empty'
    );
    expect(readRegister(cpu, 'sp')).toBe(sp);
  });

  it('into interrupts through vector 4 only when OF is set', () => {
    install(4, 9);
    expect(run('into').interrupt).toBeNull();
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);

    setFlag(cpu, 'OF', true);
    expect(run('into').interrupt).toBe(4);
    expect(readRegister(cpu, 'ip')).toBe(9);
  });

  it('a divide error enters interrupt 0 when it has a handler, and is an error otherwise', () => {
    writeRegister(cpu, 'ax', 100);
    expect(() => run('div', reg('bl'))).toThrow(CpuError);

    install(0, 6);
    const record = execute(cpu, { mnemonic: 'div', operands: [reg('bl')] }, 2);
    expect(record.interrupt).toBe(0);
    expect(readRegister(cpu, 'ip')).toBe(6);
    expect(readRegister(cpu, 'ax')).toBe(100);
    expect(stackWord(0xfff8)).toBe(3);

    undo(cpu, record);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);
    expect(readRegister(cpu, 'ip')).toBe(0);
  });

  it('pushf and popf move FLAGS through the stack, keeping only real flag bits', () => {
    run('stc');
    run('pushf');
    run('clc');
    run('popf');
    expect(getFlag(cpu, 'CF')).toBe(true);

    writeRegister(cpu, 'ax', 0xffff);
    run('push', reg('ax'));
    run('popf');
    expect(cpu.flags).toBe(0x0fd7);
  });

  it('mov stores the number of a program line, which is how a vector is filled', () => {
    run('mov', wordAt(0x84), label(8));
    expect(readMemory(cpu, physicalAddress(0x1000, 0x84), 16)).toBe(8);
    run('mov', reg('bx'), label(3));
    expect(readRegister(cpu, 'bx')).toBe(3);
  });
});

describe('registersWritten', () => {
  const line = (target: number): Operand => ({ type: 'label', target });

  it('lists a register written with the value it already held', () => {
    writeRegister(cpu, 'al', 5);
    expect(run('mov', reg('al'), imm(5)).registersWritten).toEqual(['al']);
  });

  it('names the byte register, not its parent', () => {
    writeRegister(cpu, 'ax', 7);
    writeRegister(cpu, 'bl', 2);
    expect(run('div', reg('bl')).registersWritten).toEqual(['al', 'ah']);
  });

  it('includes the registers an instruction writes without naming them', () => {
    expect(run('push', reg('ax')).registersWritten).toEqual(['sp']);
    expect(run('pop', reg('bx')).registersWritten).toEqual(['sp', 'bx']);
  });

  it('leaves out registers that are only read', () => {
    expect(run('cmp', reg('ax'), reg('bx')).registersWritten).toEqual([]);
  });

  it('counts a jump as writing IP, but not the fetch that moves IP on', () => {
    const jump = execute(cpu, { mnemonic: 'jmp', operands: [line(5)] }, 0);
    expect(jump.registersWritten).toEqual(['ip']);
    const move = execute(cpu, { mnemonic: 'mov', operands: [reg('al'), imm(1)] }, 1);
    expect(move.registersWritten).toEqual(['al']);
  });

  it('a repeat with CX = 0 writes nothing, not even CX', () => {
    const record = execute(cpu, { prefix: 'rep', mnemonic: 'stosb', operands: [] });
    expect(record.registersWritten).toEqual([]);
  });

  it('a repeat that runs writes its pointers and CX', () => {
    writeRegister(cpu, 'cx', 2);
    const record = execute(cpu, { prefix: 'rep', mnemonic: 'stosb', operands: [] });
    expect(record.registersWritten).toEqual(['di', 'cx']);
  });

  it('INTO with OF clear writes nothing', () => {
    expect(run('into').registersWritten).toEqual([]);
  });
});
