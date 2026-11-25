import { describe, expect, it } from 'vitest';
import { measure } from './comparison';
import { COMPARISON_TASKS } from './comparisonTasks';

const task = (id: string) => COMPARISON_TASKS.find((candidate) => candidate.id === id)!;

describe('COMPARISON_TASKS', () => {
  it('runs every program to its end without an error', () => {
    for (const each of COMPARISON_TASKS) {
      for (const measurement of Object.values(measure(each))) {
        expect(measurement.error, each.id).toBeNull();
      }
    }
  });

  it('gets the same answer on every architecture', () => {
    const results = (id: string) => Object.values(measure(task(id))).map((m) => m.result);
    expect(results('sum')).toEqual(['AX = 55', 'a0 = 55', 'A = 55']);
    expect(results('wide-add')).toEqual(['AX = $1333', 'a0 = $1333', '$01:$00 = $1333']);
    expect(results('multiply')).toEqual(['AX = 42', 'a2 = 42', '$01 = 42']);
    expect(results('fill')).toEqual([
      'ES:0000 = 2A 2A 2A 2A 2A 2A 2A 2A',
      '$00010000 = 2A 2A 2A 2A 2A 2A 2A 2A',
      '$0300 = 2A 2A 2A 2A 2A 2A 2A 2A'
    ]);
    expect(results('call')).toEqual(['AX = 14', 'a0 = 14', 'A = 14']);
    expect(results('light')).toEqual(['LEDs = $80', 'LEDs = $80', 'LEDs = $80']);
  });
});

describe('measure', () => {
  it('lists each line with its machine code, and the total size', () => {
    const { x86, rv32, mos6502 } = measure(task('wide-add'));
    expect(x86.listing).toEqual([
      { text: 'mov ax, 0x1234', bytes: [0xb8, 0x34, 0x12] },
      { text: 'add ax, 255', bytes: [0x05, 0xff, 0x00] }
    ]);
    expect(x86.bytes).toBe(6);
    expect(rv32.listing.map((line) => line.text)).toEqual([
      'lui a0, 1',
      'addi a0, a0, 0x234',
      'addi a0, a0, 255'
    ]);
    expect(rv32.bytes).toBe(12);
    expect(mos6502.bytes).toBe(13);
  });

  it('counts a REP string instruction as one step, with every byte it writes', () => {
    const { x86, rv32, mos6502 } = measure(task('fill'));
    expect(x86.steps).toBe(4);
    expect(rv32.steps).toBe(3 + 8 * 4);
    expect(mos6502.steps).toBe(2 + 8 * 4);
    expect([x86.memoryWrites, rv32.memoryWrites, mos6502.memoryWrites]).toEqual([8, 8, 8]);
  });

  it('counts the stack among memory writes, which a RISC-V call does not use', () => {
    const { x86, rv32, mos6502 } = measure(task('call'));
    expect([x86.memoryWrites, rv32.memoryWrites, mos6502.memoryWrites]).toEqual([2, 0, 2]);
  });

  it('counts clock cycles only on the 6502', () => {
    const { x86, rv32, mos6502 } = measure(task('wide-add'));
    expect(x86.cycles).toBeNull();
    expect(rv32.cycles).toBeNull();
    // CLC 2, LDA # 2, ADC # 2, STA zp 3, LDA # 2, ADC # 2, STA zp 3.
    expect(mos6502.cycles).toBe(16);
  });
});
