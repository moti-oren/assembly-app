import { beforeEach, describe, expect, it } from 'vitest';
import { CpuError } from '../shared/cpuError';
import { PORTS } from '../shared/devices';
import { undo } from '../shared/executionRecord';
import { setInputPort } from '../shared/state';
import { execute } from './execute';
import type { Instruction, Mnemonic } from './instructions';
import { addressOfLine } from './layout';
import type { Index, Operand } from './operands';
import { CODE_BASE, createCpuState, DEVICE_BASE, getFlag, type CpuState } from './state';

const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number, index: Index | null = null): Operand => ({
  type: 'zp',
  address,
  index
});
const abs = (address: number, index: Index | null = null): Operand => ({
  type: 'abs',
  address,
  index
});
const label = (target: number): Operand => ({ type: 'label', target });
const A: Operand = { type: 'acc' };
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

let cpu: CpuState;

beforeEach(() => {
  cpu = createCpuState();
});

const run = (instruction: Instruction, program: Instruction[] = []) =>
  execute(cpu, instruction, null, program);

describe('loads, stores and flags', () => {
  it('sets N and Z from the value loaded', () => {
    run(line('lda', imm(0x80)));
    expect(cpu.registers.a).toBe(0x80);
    expect(getFlag(cpu, 'N')).toBe(true);
    run(line('ldx', imm(0)));
    expect(getFlag(cpu, 'Z')).toBe(true);
  });

  it('wraps zero-page indexing within the zero page', () => {
    cpu.memory[0x0f] = 0x42;
    cpu.registers.x = 0x10;
    const record = run(line('lda', zp(0xff, 'x')));
    expect(cpu.registers.a).toBe(0x42);
    expect(record.addressing).toMatchObject({ base: 0xff, address: 0x0f, pageCrossed: false });
  });

  it('takes a cycle more when absolute indexing crosses a page, but not for a store', () => {
    cpu.registers.x = 0x01;
    expect(run(line('lda', abs(0x02ff, 'x'))).cycles).toBe(5);
    expect(run(line('lda', abs(0x0200, 'x'))).cycles).toBe(4);
    expect(run(line('sta', abs(0x02ff, 'x'))).cycles).toBe(5);
  });

  it('follows a pointer in the zero page for ($nn),Y', () => {
    cpu.memory[0x10] = 0xf0;
    cpu.memory[0x11] = 0x02;
    cpu.registers.y = 0x20;
    cpu.memory[0x0310] = 0x55;
    const record = run(line('lda', { type: 'izy', address: 0x10 }));
    expect(cpu.registers.a).toBe(0x55);
    expect(record.addressing).toMatchObject({
      pointer: { at: 0x10, value: 0x02f0 },
      address: 0x0310,
      pageCrossed: true
    });
    expect(record.cycles).toBe(6);
  });

  it('refuses a write into the code and reads the code as its machine code', () => {
    const program = [line('lda', imm(0x42))];
    run(line('lda', abs(CODE_BASE)), program);
    expect(cpu.registers.a).toBe(0xa9);
    expect(() => run(line('sta', abs(CODE_BASE + 1)), program)).toThrow(/Write into code/);
  });

  it('read-modify-write writes a device twice, the old byte first, as the NMOS chip does', () => {
    setInputPort(cpu, PORTS.terminal, 0x40);
    const record = run(line('inc', abs(DEVICE_BASE + PORTS.terminal)));
    expect(record.portWrites.map((write) => write.after)).toEqual([0x40, 0x41]);
    expect(cpu.io.terminal).toEqual([0x40, 0x41]);
    undo(cpu, record);
    expect(cpu.io.terminal).toEqual([]);

    const shifted = run(line('asl', abs(DEVICE_BASE + PORTS.terminal)));
    expect(shifted.portWrites.map((write) => write.after)).toEqual([0x40, 0x80]);
  });

  it('read-modify-write on RAM records one write', () => {
    cpu.memory[0x10] = 5;
    expect(run(line('dec', zp(0x10))).memoryWrites).toHaveLength(1);
    expect(cpu.memory[0x10]).toBe(4);
  });

  it('reaches the devices through memory', () => {
    run(line('lda', imm(0x81)));
    const record = run(line('sta', abs(DEVICE_BASE + PORTS.leds)));
    expect(cpu.io.out[PORTS.leds]).toBe(0x81);
    expect(record.portWrites.length).toBe(1);
    setInputPort(cpu, PORTS.switches, 0x06);
    run(line('lda', abs(DEVICE_BASE + PORTS.switches)));
    expect(cpu.registers.a).toBe(0x06);
  });
});

describe('arithmetic', () => {
  it('adds in decimal when D is set', () => {
    run(line('sed'));
    run(line('lda', imm(0x19)));
    run(line('adc', imm(0x01)));
    expect(cpu.registers.a).toBe(0x20);
  });

  it('sets N, V and Z from BIT without changing A', () => {
    cpu.memory[0x20] = 0xc0;
    run(line('lda', imm(0x01)));
    run(line('bit', zp(0x20)));
    expect([getFlag(cpu, 'N'), getFlag(cpu, 'V'), getFlag(cpu, 'Z')]).toEqual([true, true, true]);
    expect(cpu.registers.a).toBe(0x01);
  });

  it('reads, changes and writes back a byte for INC and the shifts', () => {
    cpu.memory[0x30] = 0xff;
    const record = run(line('inc', zp(0x30)));
    expect(cpu.memory[0x30]).toBe(0x00);
    expect(getFlag(cpu, 'Z')).toBe(true);
    expect(record.cycles).toBe(5);
    run(line('lda', imm(0x81)));
    run(line('asl', A));
    expect(cpu.registers.a).toBe(0x02);
    expect(getFlag(cpu, 'C')).toBe(true);
  });
});

describe('the stack, jumps and branches', () => {
  it('pushes and pulls in page 1, SP counting down', () => {
    run(line('lda', imm(0x42)));
    run(line('pha'));
    expect(cpu.memory[0x01ff]).toBe(0x42);
    expect(cpu.registers.sp).toBe(0xfe);
    run(line('lda', imm(0)));
    run(line('pla'));
    expect(cpu.registers.a).toBe(0x42);
  });

  it('pushes P with B and bit 5 set, and drops B when pulling it', () => {
    run(line('php'));
    expect(cpu.memory[0x01ff] & 0x30).toBe(0x30);
    cpu.memory[0x01ff] = 0xff;
    run(line('plp'));
    expect(cpu.flags).toBe(0xef);
  });

  it('JSR pushes the address of its last byte, RTS adds 1 to it', () => {
    const program = [line('jsr', label(2)), line('nop'), line('rts')];
    execute(cpu, program[0], 0, program);
    expect(cpu.registers.pc).toBe(addressOfLine(program, 2));
    expect([cpu.memory[0x01ff], cpu.memory[0x01fe]]).toEqual([0x06, 0x02]);
    execute(cpu, program[2], 2, program);
    expect(cpu.registers.pc).toBe(addressOfLine(program, 1));
  });

  it('reads JMP ($xxFF) the way the NMOS chip does, from $xx00 for the high byte', () => {
    const program = [line('nop'), line('nop')];
    cpu.memory[0x02ff] = 0x01;
    cpu.memory[0x0200] = 0x06;
    cpu.memory[0x0300] = 0x99;
    run(line('jmp', { type: 'ind', address: 0x02ff }), program);
    expect(cpu.registers.pc).toBe(0x0601);
  });

  it('counts a taken branch a cycle more, and one more again into another page', () => {
    const program = [line('beq', label(1)), line('nop')];
    expect(execute(cpu, program[0], 0, program).cycles).toBe(2);
    cpu.registers.pc = CODE_BASE;
    run(line('lda', imm(0)));
    const taken = execute(cpu, program[0], 0, program);
    expect(taken.cycles).toBe(3);
    expect(taken.branch).toEqual({ flag: 'Z', taken: true });
  });

  it('BRK goes through the vector at $FFFE, RTI comes back past the signature byte', () => {
    const program = [line('brk'), line('nop'), line('rti')];
    cpu.memory[0xfffe] = addressOfLine(program, 2) & 0xff;
    cpu.memory[0xffff] = addressOfLine(program, 2) >> 8;
    execute(cpu, program[0], 0, program);
    expect(cpu.registers.pc).toBe(addressOfLine(program, 2));
    expect(getFlag(cpu, 'I')).toBe(true);
    execute(cpu, program[2], 2, program);
    expect(cpu.registers.pc).toBe(addressOfLine(program, 1));
  });

  it('refuses a jump that does not land on a line, and leaves the CPU as it was', () => {
    const program = [line('rts')];
    expect(() => execute(cpu, program[0], 0, program)).toThrow(CpuError);
    expect(cpu.registers.sp).toBe(0xff);
    expect(cpu.registers.pc).toBe(CODE_BASE);
  });
});

describe('undo', () => {
  it('restores registers, flags, memory and PC', () => {
    const program = [line('sta', zp(0x10))];
    cpu.registers.a = 0x42;
    const record = execute(cpu, program[0], 0, program);
    undo(cpu, record);
    expect(cpu.memory[0x10]).toBe(0);
    expect(cpu.registers.pc).toBe(CODE_BASE);
  });

  it('refuses an addressing mode the mnemonic does not have', () => {
    expect(() => run(line('stx', zp(0x10, 'x')))).toThrow(CpuError);
    expect(() => run(line('jmp', abs(0x0600)))).toThrow(CpuError);
  });
});
