import { describe, expect, it } from 'vitest';
import {
  byteChanges,
  changeTitle,
  describeChange,
  describeFlag,
  flagEntries,
  leftOut,
  memoryEntries,
  pointerChange,
  prioritize,
  valueChange,
  writtenByte,
  type DiffEntry
} from './stepDiff';

const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, '0');

describe('valueChange', () => {
  it('is null for a value the step neither wrote nor changed', () => {
    expect(valueChange(5, 5, false, hex)).toBeNull();
  });

  it('keeps a write of the same value, marked unchanged', () => {
    expect(valueChange(0, 0, true, hex)).toEqual({
      before: '0000',
      after: '0000',
      unchanged: true,
      jump: false
    });
  });

  it('shows a change even when the write was not recorded', () => {
    expect(valueChange(0, 10, false, hex)?.after).toBe('000A');
  });
});

describe('pointerChange', () => {
  it('is a plain move when it lands on the next instruction', () => {
    expect(pointerChange(4, 5, 5, hex)).toMatchObject({
      before: '0004',
      after: '0005',
      jump: false
    });
  });

  it('is a jump anywhere else', () => {
    expect(pointerChange(4, 16, 5, hex)?.jump).toBe(true);
  });

  it('is null for a builder instruction that leaves it in place', () => {
    expect(pointerChange(4, 4, 4, hex)).toBeNull();
  });
});

describe('memory', () => {
  it('keeps the first value and the last of a byte written twice', () => {
    const writes = [
      { address: 1, before: 1, after: 2 },
      { address: 1, before: 2, after: 3 }
    ];
    expect(byteChanges(writes).get(1)).toEqual({ before: 1, after: 3 });
  });

  it('reads consecutive bytes as one little-endian value, up to the size given', () => {
    const writes = [
      { address: 0x10, before: 0, after: 0x2a },
      { address: 0x11, before: 0, after: 0x01 },
      { address: 0x12, before: 7, after: 7 }
    ];
    const entries = memoryEntries(writes, 2, (address) => `[${address}]`);
    expect(entries.map((item) => [item.name, item.before, item.after, item.unchanged])).toEqual([
      ['[16]', '0000', '012A', false],
      ['[18]', '07', '07', true]
    ]);
  });
});

describe('flagEntries', () => {
  it('lists only the flags whose bit changed', () => {
    const bits: Record<string, number> = { Z: 2, C: 1 };
    const entries = flagEntries(['Z', 'C'], 0b01, 0b11, (name) => bits[name]);
    expect(entries).toEqual([
      { name: 'Z', kind: 'flag', before: '0', after: '1', unchanged: false, jump: false }
    ]);
  });
});

describe('prioritize', () => {
  const item = (name: string, kind: DiffEntry['kind'], jump = false): DiffEntry => ({
    name,
    kind,
    before: '0',
    after: '1',
    unchanged: false,
    jump
  });

  it('puts writes first, then a jump, then flags, then the pointer moving on', () => {
    const ordered = prioritize([
      item('IP', 'pointer'),
      item('ZF', 'flag'),
      item('AX', 'register'),
      item('[0]', 'memory')
    ]);
    expect(ordered.map((entry) => entry.name)).toEqual(['AX', '[0]', 'ZF', 'IP']);
    expect(prioritize([item('ZF', 'flag'), item('IP', 'pointer', true)])[0].name).toBe('IP');
  });
});

describe('describeChange', () => {
  it('reads as before → after, and says when it jumped or stayed the same', () => {
    const base = { before: '0004', after: '0010', unchanged: false, jump: true };
    expect(describeChange(base)).toBe('0004 → 0010 (jump)');
    expect(describeChange({ ...base, before: '0010', unchanged: true, jump: false })).toBe(
      'written, value unchanged: 0010'
    );
  });
});

describe('leftOut', () => {
  it('counts what does not fit, never below zero', () => {
    expect(leftOut(6, 4)).toBe(2);
    expect(leftOut(1, 4)).toBe(0);
  });
});

describe('describeFlag', () => {
  it('says how the flag moved, or that it stayed', () => {
    expect(describeFlag('ZF', false, true)).toBe('ZF 0 → 1');
    expect(describeFlag('ZF', true, true)).toBe('ZF = 1 (unchanged)');
    expect(describeFlag('ZF', true, null)).toBe('ZF unchanged');
  });
});

describe('writtenByte', () => {
  const bytes = byteChanges([
    { address: 4, before: 0, after: 0x2a },
    { address: 5, before: 9, after: 9 }
  ]);

  it('gives a written byte its change, unchanged or not', () => {
    expect(writtenByte(bytes, 4)).toMatchObject({ before: '00', after: '2A', unchanged: false });
    expect(writtenByte(bytes, 5)).toMatchObject({ unchanged: true });
  });

  it('is null for a byte the step did not write', () => {
    expect(writtenByte(bytes, 6)).toBeNull();
  });
});

describe('changeTitle', () => {
  it('names the value, then its change', () => {
    const change = { before: '00', after: '2A', unchanged: false, jump: false };
    expect(changeTitle('AH', change)).toBe('AH: 00 → 2A');
    expect(changeTitle('AH', null)).toBe('AH');
  });
});
