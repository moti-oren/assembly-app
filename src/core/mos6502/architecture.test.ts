import { describe, expect, it } from 'vitest';
import { PORTS } from '../shared/devices';
import { runToEnd, step } from '../shared/program';
import { setInputPort } from '../shared/state';
import { MOS6502 } from './architecture';
import { assemble } from './encode';
import { getFlag, type CpuState } from './state';

function runExample(name: string, setup?: (cpu: CpuState) => void): CpuState {
  const example = MOS6502.examples.find((candidate) => candidate.name === name)!;
  const cpu = MOS6502.createState();
  setup?.(cpu);
  expect(runToEnd(MOS6502, cpu, example.program).error).toBeNull();
  return cpu;
}

describe('PC and program lines', () => {
  it('moves PC by the size of each line', () => {
    const cpu = MOS6502.createState();
    const { program } = MOS6502.examples[0];
    step(MOS6502, cpu, program);
    expect(cpu.registers.pc).toBe(0x0602);
    expect(MOS6502.nextLine(cpu, program)).toBe(1);
    MOS6502.setNextLine(cpu, 3, program);
    expect(cpu.registers.pc).toBe(0x0606);
  });
});

describe('the examples', () => {
  it('sum 1..10', () => {
    expect(runExample('Sum 1..10').registers.a).toBe(55);
  });

  it('add a 16-bit number one byte at a time', () => {
    const cpu = runExample('Add 16-bit numbers');
    expect([cpu.memory[0x00], cpu.memory[0x01]]).toEqual([0x33, 0x13]);
  });

  it('multiply by shifting and adding', () => {
    const cpu = runExample('Multiply by shifting');
    expect(cpu.memory[0x01]).toBe(42);
    expect(cpu.registers.a).toBe(0);
  });

  it('call a subroutine and return past the JSR', () => {
    const cpu = runExample('Call a subroutine');
    expect(cpu.registers.a).toBe(14);
    expect(cpu.registers.sp).toBe(0xff);
  });

  it('fill memory through a zero-page pointer', () => {
    const cpu = runExample('A pointer in the zero page');
    expect([...cpu.memory.slice(0x0300, 0x0309)]).toEqual([...Array(8).fill(0x2a), 0]);
  });

  it('light the LEDs one at a time', () => {
    expect(runExample('Running light').io.out[PORTS.leds]).toBe(0x80);
  });

  it('copy the switches and print HI', () => {
    const cpu = runExample('Switches, digits and terminal', (state) =>
      setInputPort(state, PORTS.switches, 0x06)
    );
    expect(cpu.io.out[PORTS.digits]).toBe(0x06);
    expect(cpu.io.terminal).toEqual([0x48, 0x49]);
  });

  it('add in decimal', () => {
    const cpu = runExample('Decimal mode');
    expect(cpu.memory[0x00]).toBe(0x20);
    expect(cpu.registers.a).toBe(0x00);
    expect(getFlag(cpu, 'C')).toBe(true);
    expect(getFlag(cpu, 'D')).toBe(false);
  });

  it('all assemble without a problem', () => {
    for (const example of MOS6502.examples) {
      expect(assemble(example.program).lines.every((line) => line.encoding.problem === null)).toBe(
        true
      );
    }
  });
});
