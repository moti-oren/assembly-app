import { describe, expect, it } from 'vitest';
import { PORTS } from '../shared/devices';
import { runToEnd, step } from '../shared/program';
import { setInputPort } from '../shared/state';
import { RV32 } from './architecture';
import { assemble } from './encode';
import { DATA_BASE, readRegister, STACK_TOP } from './state';
import { parseRegister } from './registers';

const reg = (cpu: ReturnType<typeof RV32.createState>, name: string) =>
  readRegister(cpu, parseRegister(name)!);

function runExample(name: string, setup?: (cpu: ReturnType<typeof RV32.createState>) => void) {
  const example = RV32.examples.find((candidate) => candidate.name === name)!;
  const cpu = RV32.createState();
  setup?.(cpu);
  const result = runToEnd(RV32, cpu, example.program);
  expect(result.error).toBeNull();
  return cpu;
}

describe('PC and program lines', () => {
  it('keeps PC at 4 bytes per line', () => {
    const cpu = RV32.createState();
    const program = RV32.examples[0].program;
    step(RV32, cpu, program);
    expect(cpu.registers.pc).toBe(4);
    expect(RV32.nextLine(cpu, program)).toBe(1);
    RV32.setNextLine(cpu, 3, program);
    expect(cpu.registers.pc).toBe(12);
  });
});

describe('the examples', () => {
  it('sum 1..10', () => {
    expect(reg(runExample('Sum 1..10'), 'a0')).toBe(55);
  });

  it('find the larger value without flags', () => {
    expect(reg(runExample('Max of a0, a1'), 'a2')).toBe(3);
  });

  it('call a function and come back through ra', () => {
    const cpu = runExample('Call a function');
    expect(reg(cpu, 'a0')).toBe(14);
    expect(reg(cpu, 'ra')).toBe(8);
  });

  it('swap through the stack and leave sp where it was', () => {
    const cpu = runExample('Swap through the stack');
    expect(reg(cpu, 'a0')).toBe(0x222);
    expect(reg(cpu, 'a1')).toBe(0x111);
    expect(reg(cpu, 'sp')).toBe(STACK_TOP);
  });

  it('build 32-bit constants', () => {
    const cpu = runExample('Build 32-bit constants');
    expect(reg(cpu, 'a0')).toBe(0x12345678);
    expect(reg(cpu, 'a1')).toBe(0x12345fff);
    expect(reg(cpu, 'a2')).toBe(0xffffffff);
  });

  it('fill and copy bytes', () => {
    const cpu = runExample('Fill and copy bytes');
    const copied = DATA_BASE + 0x10;
    expect([...cpu.memory.slice(copied, copied + 9)]).toEqual([...Array(8).fill(0x2a), 0]);
  });

  it('light the LEDs one at a time', () => {
    expect(runExample('Running light').io.out[PORTS.leds]).toBe(0x80);
  });

  it('copy the switches and print HI', () => {
    const cpu = runExample('Switches, digits and terminal', (state) =>
      setInputPort(state, PORTS.switches, 0x06)
    );
    expect(cpu.io.out[PORTS.leds]).toBe(0x06);
    expect(cpu.io.out[PORTS.digits]).toBe(0x06);
    expect(cpu.io.terminal).toEqual([0x48, 0x49]);
  });

  it('multiply and divide, by zero too', () => {
    const cpu = runExample('Multiply and divide');
    expect(reg(cpu, 'a2')).toBe(-21 >>> 0);
    expect(reg(cpu, 'a3')).toBe(-2 >>> 0);
    expect(reg(cpu, 'a4')).toBe(1);
    expect(reg(cpu, 'a5')).toBe(0xffffffff);
  });

  it('all assemble without a problem', () => {
    for (const example of RV32.examples) {
      const { lines } = assemble(example.program);
      expect(lines.every((assembled) => assembled.encoding.problem === null)).toBe(true);
    }
  });
});
