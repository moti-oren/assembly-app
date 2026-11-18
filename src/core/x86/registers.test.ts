import { describe, expect, it } from 'vitest';
import { changedRegisters, half, wordOf } from './registers';
import { createCpuState, writeRegister } from './state';
import { snapshot } from '../shared/state';

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

describe('wordOf', () => {
  it('names the word register a byte register lives in', () => {
    expect(wordOf('ah')).toBe('ax');
    expect(wordOf('dl')).toBe('dx');
    expect(wordOf('si')).toBe('si');
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
