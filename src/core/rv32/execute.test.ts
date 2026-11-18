import { beforeEach, describe, expect, it } from 'vitest';
import { CpuError } from '../shared/cpuError';
import { undo } from '../shared/executionRecord';
import { PORTS } from '../shared/devices';
import { setInputPort } from '../shared/state';
import { wordAt } from './encode';
import { execute } from './execute';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { parseRegister } from './registers';
import {
  createCpuState,
  DATA_BASE,
  DEVICE_BASE,
  readRegister,
  STACK_TOP,
  writeRegister,
  type CpuState
} from './state';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number, base: string): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

let cpu: CpuState;

beforeEach(() => {
  cpu = createCpuState();
});

const get = (name: string) => readRegister(cpu, parseRegister(name)!);
const set = (name: string, value: number) => writeRegister(cpu, parseRegister(name)!, value);
const run = (instruction: Instruction, program: Instruction[] = []) =>
  execute(cpu, instruction, null, program);

/** Runs `mnemonic a0, a1, a2` with a1 and a2 set, and returns a0. */
function compute(mnemonic: Mnemonic, a: number, b: number): number {
  set('a1', a);
  set('a2', b);
  run(line(mnemonic, r('a0'), r('a1'), r('a2')));
  return get('a0');
}

describe('registers', () => {
  it('starts with sp at the top of RAM and pc at the first line', () => {
    expect(get('sp')).toBe(STACK_TOP);
    expect(cpu.registers.pc).toBe(0);
  });

  it('throws away writes to x0 and does not list them', () => {
    const record = run(line('addi', r('zero'), r('zero'), imm(5)));
    expect(get('zero')).toBe(0);
    expect(record.registersWritten).toEqual([]);
  });

  it('lists the registers an instruction wrote, by their x name', () => {
    const record = run(line('addi', r('a0'), r('zero'), imm(5)));
    expect(record.registersWritten).toEqual(['x10']);
  });
});

describe('arithmetic and logic', () => {
  it('adds and subtracts modulo 2^32', () => {
    expect(compute('add', 0xffffffff, 1)).toBe(0);
    expect(compute('sub', 0, 1)).toBe(0xffffffff);
  });

  it('sign-extends a 12-bit immediate', () => {
    set('a1', 10);
    run(line('addi', r('a0'), r('a1'), imm(-1)));
    expect(get('a0')).toBe(9);
    run(line('andi', r('a0'), r('a1'), imm(-1)));
    expect(get('a0')).toBe(10);
  });

  it('compares signed with SLT and unsigned with SLTU', () => {
    expect(compute('slt', 0xffffffff, 1)).toBe(1); // -1 < 1
    expect(compute('sltu', 0xffffffff, 1)).toBe(0); // 4294967295 > 1
    set('a1', 5);
    run(line('sltiu', r('a0'), r('a1'), imm(-1))); // compares with 0xFFFFFFFF
    expect(get('a0')).toBe(1);
  });

  it('shifts by the low 5 bits of rs2', () => {
    expect(compute('sll', 1, 33)).toBe(2);
    expect(compute('srl', 0x80000000, 4)).toBe(0x08000000);
    expect(compute('sra', 0x80000000, 4)).toBe(0xf8000000);
  });

  it('builds a value with LUI and AUIPC', () => {
    run(line('lui', r('a0'), imm(0x12345)));
    expect(get('a0')).toBe(0x12345000);
    cpu.registers.pc = 0x100;
    run(line('auipc', r('a1'), imm(1)));
    expect(get('a1')).toBe(0x1100);
  });
});

describe('multiply and divide', () => {
  it('keeps the low or the high half of the 64-bit product', () => {
    expect(compute('mul', 0xffffffff, 0xffffffff)).toBe(1);
    expect(compute('mulh', 0xffffffff, 0xffffffff)).toBe(0); // -1 × -1 = 1
    expect(compute('mulhu', 0xffffffff, 0xffffffff)).toBe(0xfffffffe);
    expect(compute('mulhsu', 0xffffffff, 2)).toBe(0xffffffff); // -1 × 2 = -2
  });

  it('rounds division toward zero', () => {
    expect(compute('div', 7, -3 >>> 0)).toBe(-2 >>> 0);
    expect(compute('rem', 7, -3 >>> 0)).toBe(1);
    expect(compute('rem', -7 >>> 0, 3)).toBe(-1 >>> 0);
  });

  it('does not trap when dividing by zero or overflowing', () => {
    expect(compute('div', 7, 0)).toBe(0xffffffff);
    expect(compute('divu', 7, 0)).toBe(0xffffffff);
    expect(compute('rem', 7, 0)).toBe(7);
    expect(compute('remu', 7, 0)).toBe(7);
    expect(compute('div', 0x80000000, 0xffffffff)).toBe(0x80000000);
    expect(compute('rem', 0x80000000, 0xffffffff)).toBe(0);
  });
});

describe('loads and stores', () => {
  beforeEach(() => set('s0', DATA_BASE));

  it('stores little-endian and loads back with or without sign extension', () => {
    set('t0', 0x80f1f2f3);
    const record = run(line('sw', r('t0'), at(4, 's0')));
    expect([...cpu.memory.slice(DATA_BASE + 4, DATA_BASE + 8)]).toEqual([0xf3, 0xf2, 0xf1, 0x80]);
    expect(record.memoryWrites.length).toBe(4);
    run(line('lw', r('a0'), at(4, 's0')));
    expect(get('a0')).toBe(0x80f1f2f3);
    run(line('lb', r('a0'), at(4, 's0')));
    expect(get('a0')).toBe(0xfffffff3);
    run(line('lbu', r('a0'), at(4, 's0')));
    expect(get('a0')).toBe(0xf3);
    run(line('lh', r('a0'), at(6, 's0')));
    expect(get('a0')).toBe(0xffff80f1);
    run(line('lhu', r('a0'), at(6, 's0')));
    expect(get('a0')).toBe(0x80f1);
  });

  it('records what each access touched', () => {
    set('t0', 0x1234abcd);
    expect(run(line('sh', r('t0'), at(2, 's0'))).access).toEqual({
      address: DATA_BASE + 2,
      size: 2,
      write: true,
      region: 'ram',
      value: 0xabcd
    });
    expect(run(line('lb', r('a0'), at(2, 's0'))).access).toMatchObject({
      write: false,
      value: 0xcd
    });
    const program = [line('addi', r('a0'), r('zero'), imm(5))];
    expect(run(line('lw', r('a0'), at(0, 'zero')), program).access?.region).toBe('code');
  });

  it('traps a misaligned access and leaves the CPU as it was', () => {
    expect(() => run(line('lw', r('a0'), at(2, 's0')))).toThrow(/Misaligned load/);
    expect(() => run(line('sh', r('a0'), at(1, 's0')))).toThrow(/Misaligned store/);
    expect(get('a0')).toBe(0);
  });

  it('faults outside RAM and the devices', () => {
    set('s0', 0x00100000);
    expect(() => run(line('lw', r('a0'), at(0, 's0')))).toThrow(/Access fault/);
  });

  it('reads the code as its machine code, but will not write it', () => {
    const program = [
      line('addi', r('a0'), r('zero'), imm(5)),
      line('add', r('a0'), r('a1'), r('a2'))
    ];
    run(line('lw', r('t0'), at(4, 'zero')), program);
    expect(get('t0')).toBe(wordAt(program, 1));
    expect(() => run(line('sw', r('t0'), at(0, 'zero')), program)).toThrow(
      /Store into code: .* holds L0/
    );
  });

  it('reaches the devices with byte loads and stores', () => {
    set('s0', DEVICE_BASE);
    set('t0', 0x81);
    const record = run(line('sb', r('t0'), at(PORTS.leds, 's0')));
    expect(cpu.io.out[PORTS.leds]).toBe(0x81);
    expect(record.portWrites).toEqual([{ port: PORTS.leds, before: 0, after: 0x81 }]);
    setInputPort(cpu, PORTS.switches, 0x42);
    run(line('lbu', r('a0'), at(PORTS.switches, 's0')));
    expect(get('a0')).toBe(0x42);
    expect(() => run(line('sw', r('t0'), at(PORTS.leds, 's0')))).toThrow(/one byte each/);
  });
});

describe('branches and jumps', () => {
  const program = [
    line('jal', r('ra'), label(2)),
    line('addi', r('a0'), r('zero'), imm(1)),
    line('jalr', r('zero'), at(0, 'ra'))
  ];

  it('moves PC past the line before running it, so JAL links the next line', () => {
    execute(cpu, program[0], 0, program);
    expect(cpu.registers.pc).toBe(8);
    expect(get('ra')).toBe(4);
    execute(cpu, program[2], 2, program);
    expect(cpu.registers.pc).toBe(4);
  });

  it('takes a branch only when its condition holds', () => {
    const nop = line('addi', r('zero'), r('zero'), imm(0));
    const branch = [line('blt', r('a0'), r('a1'), label(3)), nop, nop];
    set('a0', 0xffffffff);
    set('a1', 1);
    execute(cpu, branch[0], 0, branch);
    expect(cpu.registers.pc).toBe(12);
    cpu.registers.pc = 0;
    execute(cpu, line('bltu', r('a0'), r('a1'), label(3)), 0, branch);
    expect(cpu.registers.pc).toBe(4);
  });

  it('records the two values a branch compared', () => {
    set('a0', 3);
    const record = run(line('bge', r('a0'), r('zero'), label(0)), program);
    expect(record.comparison).toEqual({ a: 3, b: 0, taken: true });
    expect(run(line('beq', r('a0'), r('zero'), label(0)), program).comparison?.taken).toBe(false);
  });

  it('works out the JALR target before writing rd', () => {
    set('ra', 8);
    execute(cpu, line('jalr', r('ra'), at(0, 'ra')), 0, program);
    expect(cpu.registers.pc).toBe(8);
    expect(get('ra')).toBe(4);
  });

  it('refuses a jump to an address that is not a program line', () => {
    set('t0', 6);
    expect(() => run(line('jalr', r('zero'), at(0, 't0')), program)).toThrow(/misaligned/);
    set('t0', 0x40);
    expect(() => run(line('jalr', r('zero'), at(0, 't0')), program)).toThrow(/No program line/);
    expect(cpu.registers.pc).toBe(0);
  });

  it('leaves PC alone for an instruction run directly, unless it jumps', () => {
    cpu.registers.pc = 4;
    run(line('addi', r('a0'), r('zero'), imm(1)), program);
    expect(cpu.registers.pc).toBe(4);
    run(line('jal', r('zero'), label(0)), program);
    expect(cpu.registers.pc).toBe(0);
  });
});

describe('undo', () => {
  it('restores registers, PC, memory and devices', () => {
    set('s0', DATA_BASE);
    set('t0', 0x12345678);
    const program = [line('sw', r('t0'), at(0, 's0'))];
    const record = execute(cpu, program[0], 0, program);
    expect(cpu.registers.pc).toBe(4);
    undo(cpu, record);
    expect(cpu.registers.pc).toBe(0);
    expect([...cpu.memory.slice(DATA_BASE, DATA_BASE + 4)]).toEqual([0, 0, 0, 0]);
  });

  it('refuses an instruction with an operand out of range', () => {
    expect(() => run(line('addi', r('a0'), r('a0'), imm(2048)))).toThrow(CpuError);
    expect(() => run(line('slli', r('a0'), r('a0'), imm(32)))).toThrow(CpuError);
    expect(() => run(line('lui', r('a0'), imm(0x100000)))).toThrow(CpuError);
  });
});
