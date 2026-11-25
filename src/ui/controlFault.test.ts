import { describe, expect, it } from 'vitest';
import { solveControl } from '@/core/controlLink';
import type { Faults } from '@/core/logic/fault';
import { RV32_CONTROL } from '@/core/rv32Control';
import { faultNote, faultRows, faultSummary, lineName } from './controlFault';

/** `add a0, a0, a1` and `lw a0, 8(sp)`. */
const ADD = 0x00b50533;
const LW = 0x00812503;

function rows(word: number, faults: Faults) {
  return faultRows(
    solveControl(RV32_CONTROL, word, faults),
    solveControl(RV32_CONTROL, word),
    faults
  );
}

const row = (word: number, faults: Faults, id: string) =>
  rows(word, faults).find((line) => line.id === id)!;

describe('faultRows', () => {
  it('sets a broken line beside what it would be', () => {
    expect(row(ADD, { regWrite: 0 }, 'regWrite')).toMatchObject({
      on: false,
      healthy: true,
      stuck: 0
    });
    expect(row(ADD, { regWrite: 0 }, 'aluSum')).toMatchObject({
      on: true,
      healthy: true,
      stuck: null
    });
  });
});

describe('lineName', () => {
  it('says the value of a line, and when it is stuck', () => {
    expect(lineName(row(ADD, {}, 'regWrite'))).toBe('RegWrite = 1');
    expect(lineName(row(ADD, { regWrite: 0 }, 'regWrite'))).toBe('RegWrite = 0, stuck');
  });
});

describe('faultNote', () => {
  it('says what a line does while it works', () => {
    expect(faultNote(row(ADD, {}, 'regWrite'))).toContain('RegWrite works: it is 1');
  });

  it('says what stops when a line is held at 0', () => {
    expect(faultNote(row(ADD, { regWrite: 0 }, 'regWrite'))).toContain(
      'so this no longer happens: rd'
    );
  });

  it('says what starts when a line is held at 1', () => {
    expect(faultNote(row(ADD, { memWrite: 1 }, 'memWrite'))).toContain('so now rs2 is written');
  });

  it('says when the instruction asks for the same', () => {
    expect(faultNote(row(ADD, { regWrite: 1 }, 'regWrite'))).toContain('anyway');
  });
});

describe('faultSummary', () => {
  it('is null while every line works', () => {
    expect(faultSummary(rows(ADD, {}))).toBeNull();
  });

  it('names the broken lines and every line that changed', () => {
    const summary = faultSummary(rows(LW, { aluAdd: 0 }))!;
    expect(summary.broken).toBe('Stuck: ALUAdd at 0.');
    expect(summary.effect).toContain('ALUAdd is 0');
    expect(summary.effect).toContain('Sum is 0');
  });

  it('says when nothing changed', () => {
    expect(faultSummary(rows(ADD, { regWrite: 1 }))!.effect).toContain('asks for the same');
  });
});
