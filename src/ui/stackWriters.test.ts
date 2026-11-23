import { describe, expect, it } from 'vitest';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { followHistory, newWriters, writerOf } from './stackWriters';

function record(...addresses: number[]): ExecutionRecord {
  return {
    instruction: null,
    line: null,
    before: { registers: {}, flags: 0 },
    memoryWrites: addresses.map((address) => ({ address, before: 0, after: 1 })),
    portWrites: [],
    registersWritten: []
  };
}

describe('followHistory', () => {
  it('keeps the last record that wrote each address', () => {
    const writers = newWriters();
    followHistory(writers, [record(8, 9), record(), record(9)]);
    expect(writerOf(writers, 8, 1)).toBe(0);
    expect(writerOf(writers, 9, 1)).toBe(2);
    expect(writerOf(writers, 10, 1)).toBeNull();
  });

  it('takes the newest writer of a cell of several bytes', () => {
    const writers = newWriters();
    followHistory(writers, [record(8, 9, 10, 11), record(10)]);
    expect(writerOf(writers, 8, 4)).toBe(1);
    expect(writerOf(writers, 8, 2)).toBe(0);
  });

  it('reads only the new records of a history that grew', () => {
    const writers = newWriters();
    const first = [record(8)];
    followHistory(writers, first);
    // The record already read is not looked at again: changing it goes unnoticed.
    const grown = [first[0], record(9)];
    first[0].memoryWrites.push({ address: 20, before: 0, after: 1 });
    followHistory(writers, grown);
    expect(writerOf(writers, 9, 1)).toBe(1);
    expect(writerOf(writers, 20, 1)).toBeNull();
  });

  it('starts again after an undo, and when another history takes its place', () => {
    const writers = newWriters();
    const history = [record(8), record(8)];
    followHistory(writers, history);
    followHistory(writers, history.slice(0, 1));
    expect(writerOf(writers, 8, 1)).toBe(0);
    followHistory(writers, [record(30)]);
    expect(writerOf(writers, 8, 1)).toBeNull();
    expect(writerOf(writers, 30, 1)).toBe(0);
  });
});
