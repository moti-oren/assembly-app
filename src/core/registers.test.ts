import { describe, expect, it } from 'vitest';
import { changedRegisters, half } from './registers';
import { createCpuState, snapshot, writeRegister } from './state';

describe('changedRegisters', () => {
  it('lists the registers that differ, in register order', () => {
    const cpu = createCpuState();
    const before = snapshot(cpu);
    writeRegister(cpu, 'ip', 3);
    writeRegister(cpu, 'bl', 1);
    writeRegister(cpu, 'ax', 0);
    expect(changedRegisters(before.registers, cpu.registers)).toEqual(['bx', 'ip']);
  });
});

describe('half', () => {
  it('names the byte halves of a split register', () => {
    expect(half('ax', 'h')).toBe('ah');
    expect(half('dx', 'l')).toBe('dl');
  });

  it('refuses a register without halves', () => {
    expect(() => half('si', 'l')).toThrow();
  });
});
