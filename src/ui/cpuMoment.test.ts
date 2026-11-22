import { describe, expect, it } from 'vitest';
import type { AluLink } from '@/core/aluLink';
import { momentOf } from './cpuMoment';

/** A record is its own text here; one starting with `add` has a circuit. */
const link = (record: string): AluLink =>
  record.startsWith('add')
    ? {
        request: { kind: 'add', width: 8, a: 1, b: 2, carryIn: 0 },
        taps: [],
        cleared: [],
        resultKept: true,
        note: null
      }
    : { unavailable: 'no circuit' };

const moment = (history: string[], future: string[] = []) =>
  momentOf({ cpu: '8086', history, future, format: (record) => record, link });

describe('momentOf', () => {
  it('has no instruction before anything has run', () => {
    expect(moment([])).toEqual({
      cpu: '8086',
      position: 0,
      total: 0,
      instruction: null,
      link: null,
      previous: null,
      next: null
    });
  });

  it('shows the last instruction and where it leads', () => {
    const now = moment(['mov ax, 1', 'add ax, 2']);
    expect(now).toMatchObject({ position: 2, total: 2, instruction: 'add ax, 2' });
    expect(now.link).toHaveProperty('request');
  });

  it('finds the nearest instructions with a circuit, back and forward', () => {
    const now = moment(['add ax, 1', 'mov bx, 1', 'mov cx, 1'], ['mov dx, 1', 'add ax, 3']);
    expect(now).toMatchObject({ position: 3, total: 5, previous: 1, next: 5 });
  });

  it('does not count the instruction on show as the one before it', () => {
    expect(moment(['add ax, 1']).previous).toBeNull();
  });
});
