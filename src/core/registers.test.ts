import { describe, expect, it } from 'vitest';
import { changedRegisters } from './registers';
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
