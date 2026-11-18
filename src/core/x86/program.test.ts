import { beforeEach, describe, expect, it } from 'vitest';
import { CpuError } from '../shared/cpuError';
import { execute } from './execute';
import { undo } from '../shared/executionRecord';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { runToEnd, step, type Program } from '../shared/program';
import { X86 } from './architecture';
import { EXAMPLE_PROGRAMS } from './program';
import type { RegisterName } from './registers';
import { createCpuState, readRegister, writeRegister, type CpuState } from './state';
import { setInputPort } from '../shared/state';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

let cpu: CpuState;

beforeEach(() => {
  cpu = createCpuState();
});

describe('stepping', () => {
  it('advances IP line by line and stops at the end', () => {
    const program: Program<Instruction> = [line('mov', reg('ax'), imm(1)), line('inc', reg('ax'))];
    step(X86, cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(1);
    const record = step(X86, cpu, program);
    expect(record.line).toBe(1);
    expect(readRegister(cpu, 'ip')).toBe(2);
    expect(readRegister(cpu, 'ax')).toBe(2);
    expect(() => step(X86, cpu, program)).toThrow(CpuError);
  });

  it('undo of a step restores IP', () => {
    const program: Program<Instruction> = [line('jmp', label(5))];
    const record = step(X86, cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(5);
    undo(cpu, record);
    expect(readRegister(cpu, 'ip')).toBe(0);
  });

  it('instructions run directly do not move IP, except jumps', () => {
    execute(cpu, line('inc', reg('ax')));
    expect(readRegister(cpu, 'ip')).toBe(0);
    execute(cpu, line('jmp', label(3)));
    expect(readRegister(cpu, 'ip')).toBe(3);
  });
});

describe('conditional jumps', () => {
  function jumps(setup: Instruction[], jump: Mnemonic): boolean {
    cpu = createCpuState();
    setup.forEach((instruction) => execute(cpu, instruction));
    writeRegister(cpu, 'ip', 0);
    step(X86, cpu, [line(jump, label(9))]);
    return readRegister(cpu, 'ip') === 9;
  }

  const compare = (a: number, b: number) => [
    line('mov', reg('ax'), imm(a)),
    line('cmp', reg('ax'), imm(b))
  ];

  it('equality', () => {
    expect(jumps(compare(5, 5), 'je')).toBe(true);
    expect(jumps(compare(5, 4), 'je')).toBe(false);
    expect(jumps(compare(5, 4), 'jne')).toBe(true);
  });

  it('unsigned comparisons look at CF', () => {
    // 0xFFFF is 65535 unsigned: above 1.
    expect(jumps(compare(0xffff, 1), 'ja')).toBe(true);
    expect(jumps(compare(0xffff, 1), 'jb')).toBe(false);
    expect(jumps(compare(1, 1), 'jae')).toBe(true);
    expect(jumps(compare(1, 1), 'jbe')).toBe(true);
  });

  it('signed comparisons look at SF and OF', () => {
    // 0xFFFF is -1 signed: less than 1.
    expect(jumps(compare(0xffff, 1), 'jl')).toBe(true);
    expect(jumps(compare(0xffff, 1), 'jg')).toBe(false);
    expect(jumps(compare(-32768, 1), 'jl')).toBe(true); // overflow case: SF = 0, OF = 1
    expect(jumps(compare(3, 3), 'jge')).toBe(true);
    expect(jumps(compare(3, 3), 'jle')).toBe(true);
    expect(jumps(compare(3, 3), 'jg')).toBe(false);
  });

  it('jcxz looks at CX', () => {
    expect(jumps([], 'jcxz')).toBe(true);
    expect(jumps([line('mov', reg('cx'), imm(1))], 'jcxz')).toBe(false);
  });
});

describe('loops and calls', () => {
  it('loop decrements CX without touching flags', () => {
    execute(cpu, line('stc'));
    const flags = cpu.flags;
    writeRegister(cpu, 'cx', 1);
    step(X86, cpu, [line('loop', label(0))]);
    expect(readRegister(cpu, 'cx')).toBe(0);
    expect(readRegister(cpu, 'ip')).toBe(1); // CX reached 0: falls through
    expect(cpu.flags).toBe(flags);
  });

  it('call pushes the next line and ret returns to it', () => {
    const program: Program<Instruction> = [line('call', label(2)), line('nop'), line('ret')];
    const sp = readRegister(cpu, 'sp');
    step(X86, cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(2);
    expect(readRegister(cpu, 'sp')).toBe(sp - 2);
    step(X86, cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(1);
    expect(readRegister(cpu, 'sp')).toBe(sp);
  });
});

describe('runToEnd', () => {
  it('runs the examples', () => {
    const [sum, max, call, swap, fill, light, devices, interrupt] = EXAMPLE_PROGRAMS.map(
      (example) => example.program
    );

    expect(runToEnd(X86, cpu, sum).error).toBeNull();
    expect(readRegister(cpu, 'ax')).toBe(55);

    cpu = createCpuState();
    runToEnd(X86, cpu, max);
    expect(readRegister(cpu, 'dx')).toBe(3);

    cpu = createCpuState();
    runToEnd(X86, cpu, call);
    expect(readRegister(cpu, 'ax')).toBe(14);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);

    cpu = createCpuState();
    runToEnd(X86, cpu, swap);
    expect(readRegister(cpu, 'ax')).toBe(0x2222);
    expect(readRegister(cpu, 'bx')).toBe(0x1111);

    cpu = createCpuState();
    expect(runToEnd(X86, cpu, fill).error).toBeNull();
    const copied = cpu.registers.ds * 16 + 0x10;
    expect([...cpu.memory.slice(copied, copied + 9)]).toEqual([...Array(8).fill(0x2a), 0]);

    cpu = createCpuState();
    expect(runToEnd(X86, cpu, light).error).toBeNull();
    expect(cpu.io.out[0x10]).toBe(0x80);

    cpu = createCpuState();
    setInputPort(cpu, 0x11, 0x06);
    runToEnd(X86, cpu, devices);
    expect(cpu.io.out[0x10]).toBe(0x06);
    expect(cpu.io.out[0x12]).toBe(0x06);
    expect(cpu.io.terminal).toEqual([0x48, 0x49]);

    cpu = createCpuState();
    expect(runToEnd(X86, cpu, interrupt).error).toBeNull();
    expect(cpu.io.terminal).toEqual([0x41, 0x42]);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);
  });

  it('stops at the first error and keeps what ran before it', () => {
    const result = runToEnd(X86, cpu, [
      line('inc', reg('ax')),
      line('div', reg('bl')),
      line('inc', reg('ax'))
    ]);
    expect(result.records.length).toBe(1);
    expect(result.error?.message).toContain('divisor is 0');
    expect(readRegister(cpu, 'ip')).toBe(1);
  });
});
