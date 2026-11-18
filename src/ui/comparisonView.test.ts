import { describe, expect, it } from 'vitest';
import { measure, type Measurement } from '@/core/comparison';
import { COMPARISON_TASKS } from '@/core/comparisonTasks';
import { codeText, metricRows } from './comparisonView';

const measured = (fields: Partial<Measurement>): Measurement => ({
  listing: [],
  bytes: 0,
  steps: 0,
  memoryWrites: 0,
  cycles: null,
  result: '',
  error: null,
  ...fields
});

describe('metricRows', () => {
  it('gives every measure a value per architecture', () => {
    const [sum] = COMPARISON_TASKS;
    const rows = metricRows(measure(sum));
    expect(rows.map((row) => row.label)).toEqual([
      'Lines',
      'Code bytes',
      'Instructions run',
      'Memory writes',
      'Clock cycles'
    ]);
    expect(rows[0].values).toEqual({ x86: '4', rv32: '5', mos6502: '7' });
    expect(rows[4].values.x86).toBe('—');
  });

  it('marks the architectures that need the least', () => {
    const rows = metricRows({
      x86: measured({ bytes: 6, steps: 2 }),
      rv32: measured({ bytes: 12, steps: 2 }),
      mos6502: measured({ bytes: 6, steps: 7 })
    });
    expect(rows.find((row) => row.label === 'Code bytes')!.least).toEqual(['x86', 'mos6502']);
    expect(rows.find((row) => row.label === 'Instructions run')!.least).toEqual(['x86', 'rv32']);
  });

  it('marks nobody when all need the same, or only one is counted', () => {
    const rows = metricRows({
      x86: measured({ memoryWrites: 8 }),
      rv32: measured({ memoryWrites: 8 }),
      mos6502: measured({ memoryWrites: 8, cycles: 16 })
    });
    expect(rows.find((row) => row.label === 'Memory writes')!.least).toEqual([]);
    expect(rows.find((row) => row.label === 'Clock cycles')!.least).toEqual([]);
  });
});

describe('codeText', () => {
  it('writes bytes as two hex digits each', () => {
    expect(codeText([0xb8, 0x34, 0x12])).toBe('B8 34 12');
    expect(codeText([0x05])).toBe('05');
  });
});
