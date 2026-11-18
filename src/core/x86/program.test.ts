import { beforeEach, describe, expect, it } from 'vitest';
import { CpuError } from '../shared/cpuError';
import { execute } from './execute';
import { undo } from '../shared/executionRecord';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import {
  EXAMPLE_PROGRAMS,
  insertLine,
  ipAfterInsert,
  removeLine,
  runToEnd,
  step,
  type Program
} from './program';
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
    const program: Program = [line('mov', reg('ax'), imm(1)), line('inc', reg('ax'))];
    step(cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(1);
    const record = step(cpu, program);
    expect(record.line).toBe(1);
    expect(readRegister(cpu, 'ip')).toBe(2);
    expect(readRegister(cpu, 'ax')).toBe(2);
    expect(() => step(cpu, program)).toThrow(CpuError);
  });

  it('undo of a step restores IP', () => {
    const program: Program = [line('jmp', label(5))];
    const record = step(cpu, program);
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
    step(cpu, [line(jump, label(9))]);
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
    step(cpu, [line('loop', label(0))]);
    expect(readRegister(cpu, 'cx')).toBe(0);
    expect(readRegister(cpu, 'ip')).toBe(1); // CX reached 0: falls through
    expect(cpu.flags).toBe(flags);
  });

  it('call pushes the next line and ret returns to it', () => {
    const program: Program = [line('call', label(2)), line('nop'), line('ret')];
    const sp = readRegister(cpu, 'sp');
    step(cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(2);
    expect(readRegister(cpu, 'sp')).toBe(sp - 2);
    step(cpu, program);
    expect(readRegister(cpu, 'ip')).toBe(1);
    expect(readRegister(cpu, 'sp')).toBe(sp);
  });
});

describe('runToEnd', () => {
  it('runs the examples', () => {
    const [sum, max, call, swap, fill, light, devices, interrupt] = EXAMPLE_PROGRAMS.map(
      (example) => example.program
    );

    expect(runToEnd(cpu, sum).error).toBeNull();
    expect(readRegister(cpu, 'ax')).toBe(55);

    cpu = createCpuState();
    runToEnd(cpu, max);
    expect(readRegister(cpu, 'dx')).toBe(3);

    cpu = createCpuState();
    runToEnd(cpu, call);
    expect(readRegister(cpu, 'ax')).toBe(14);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);

    cpu = createCpuState();
    runToEnd(cpu, swap);
    expect(readRegister(cpu, 'ax')).toBe(0x2222);
    expect(readRegister(cpu, 'bx')).toBe(0x1111);

    cpu = createCpuState();
    expect(runToEnd(cpu, fill).error).toBeNull();
    const copied = cpu.registers.ds * 16 + 0x10;
    expect([...cpu.memory.slice(copied, copied + 9)]).toEqual([...Array(8).fill(0x2a), 0]);

    cpu = createCpuState();
    expect(runToEnd(cpu, light).error).toBeNull();
    expect(cpu.io.out[0x10]).toBe(0x80);

    cpu = createCpuState();
    setInputPort(cpu, 0x11, 0x06);
    runToEnd(cpu, devices);
    expect(cpu.io.out[0x10]).toBe(0x06);
    expect(cpu.io.out[0x12]).toBe(0x06);
    expect(cpu.io.terminal).toEqual([0x48, 0x49]);

    cpu = createCpuState();
    expect(runToEnd(cpu, interrupt).error).toBeNull();
    expect(cpu.io.terminal).toEqual([0x41, 0x42]);
    expect(readRegister(cpu, 'sp')).toBe(0xfffe);
  });

  it('stops endless loops', () => {
    const result = runToEnd(cpu, [line('jmp', label(0))], 50);
    expect(result.records.length).toBe(50);
    expect(result.error?.message).toContain('50 steps');
  });

  it('stops a loop that writes too much memory, long before the step limit', () => {
    const fill: Program = [
      line('mov', reg('cx'), imm(100)),
      { prefix: 'rep', mnemonic: 'stosb', operands: [] },
      line('jmp', label(0))
    ];
    const result = runToEnd(cpu, fill, 1000, 250);
    // Three REPs of 100 bytes pass the limit of 250; the run stops before the next step.
    expect(result.records.length).toBe(8);
    expect(result.records.reduce((sum, record) => sum + record.memoryWrites.length, 0)).toBe(300);
    expect(result.error?.message).toContain('250 memory writes');
  });

  it('stops at the first error and keeps what ran before it', () => {
    const result = runToEnd(cpu, [
      line('inc', reg('ax')),
      line('div', reg('bl')),
      line('inc', reg('ax'))
    ]);
    expect(result.records.length).toBe(1);
    expect(result.error?.message).toContain('divisor is 0');
    expect(readRegister(cpu, 'ip')).toBe(1);
  });
});

describe('editing a program', () => {
  const program: Program = [
    line('mov', reg('cx'), imm(3)),
    line('dec', reg('cx')),
    line('jnz', label(1)),
    line('jmp', label(4)) // L4 = the end of the program
  ];

  it('inserting keeps jumps on the same instructions', () => {
    const edited = insertLine(program, 1, line('nop'));
    expect(edited[1].mnemonic).toBe('nop');
    expect(edited[3].operands[0]).toEqual(label(2)); // still points at "dec cx"
    expect(edited[4].operands[0]).toEqual(label(5)); // still the end
  });

  it('labels in the inserted line refer to the program before the insert', () => {
    // "jmp L1" inserted above line 1 means "jump to dec cx", which moves to line 2.
    const edited = insertLine(program, 1, line('jmp', label(1)));
    expect(edited[1].operands[0]).toEqual(label(2));
    expect(edited[2].mnemonic).toBe('dec');
  });

  it('removing a line moves jumps to the line that replaced it', () => {
    const edited = removeLine(program, 1);
    expect(edited.length).toBe(3);
    expect(edited[1].operands[0]).toEqual(label(1)); // now the jnz itself
    expect(edited[2].operands[0]).toEqual(label(3)); // still the end
  });

  it('IP keeps pointing at the same instruction', () => {
    expect(ipAfterInsert(2, 1)).toBe(3);
    expect(ipAfterInsert(4, 4)).toBe(4); // appended at IP: the new line runs next
  });
});
