import { describe, expect, it } from 'vitest';
import { explainAddress, explainOffset, formatPhysical } from './address';
import { effectiveAddress, effectiveOffset, type Operand } from './operands';
import { createCpuState, physicalAddress, snapshot, writeRegister } from './state';

type MemoryOperand = Extract<Operand, { type: 'mem' }>;

describe('explainAddress', () => {
  it('shifts the segment left by 4 bits and adds the offset', () => {
    expect(explainAddress(0x1000, 0x0010)).toEqual({
      segment: 0x1000,
      offset: 0x0010,
      shifted: 0x10000,
      sum: 0x10010,
      physical: 0x10010,
      wrapped: false
    });
  });

  it('reaches the last byte of memory without wrapping', () => {
    const top = explainAddress(0xffff, 0x000f);
    expect(top.physical).toBe(0xfffff);
    expect(top.wrapped).toBe(false);
  });

  it('wraps around past 1MB, as the 20-bit address bus does', () => {
    const wrapped = explainAddress(0xffff, 0x0010);
    expect(wrapped.sum).toBe(0x100000);
    expect(wrapped.physical).toBe(0x00000);
    expect(wrapped.wrapped).toBe(true);
  });

  it('agrees with physicalAddress', () => {
    const pairs = [
      [0x0000, 0x0000],
      [0x1000, 0xffff],
      [0x2000, 0xfffe],
      [0xffff, 0xffff],
      [0xf800, 0x8000]
    ];
    for (const [segment, offset] of pairs) {
      expect(explainAddress(segment, offset).physical).toBe(physicalAddress(segment, offset));
    }
  });
});

describe('formatPhysical', () => {
  it('writes a 20-bit address as five hex digits', () => {
    expect(formatPhysical(0x1234)).toBe('01234');
    expect(formatPhysical(0xfffff)).toBe('FFFFF');
  });
});

describe('explainOffset', () => {
  it('adds the base register and the displacement', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'bx', 0x0100);
    const operand: MemoryOperand = { type: 'mem', size: 8, base: 'bx', displacement: 0x20 };
    expect(explainOffset(cpu, operand)).toEqual({
      base: 'bx',
      baseValue: 0x0100,
      displacement: 0x20,
      offset: 0x0120,
      wrapped: false
    });
  });

  it('is just the displacement for a direct address', () => {
    const cpu = createCpuState();
    const operand: MemoryOperand = { type: 'mem', size: 16, base: null, displacement: 0x1234 };
    expect(explainOffset(cpu, operand)).toMatchObject({ base: null, offset: 0x1234 });
  });

  it('wraps inside the segment at 64K and agrees with effectiveOffset', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'si', 0xffff);
    const operand: MemoryOperand = { type: 'mem', size: 8, base: 'si', displacement: 2 };
    const breakdown = explainOffset(cpu, operand);
    expect(breakdown.offset).toBe(0x0001);
    expect(breakdown.wrapped).toBe(true);
    expect(breakdown.offset).toBe(effectiveOffset(cpu, operand));
  });

  it('works from a snapshot of the registers alone', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'bx', 0x0100);
    const before = snapshot(cpu);
    writeRegister(cpu, 'bx', 0x0200);
    const operand: MemoryOperand = { type: 'mem', size: 8, base: 'bx', displacement: 4 };
    expect(explainOffset(before, operand).offset).toBe(0x0104);
    expect(effectiveAddress(before, operand)).toBe(physicalAddress(cpu.registers.ds, 0x0104));
  });
});
