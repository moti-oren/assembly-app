import { describe, expect, it } from 'vitest';
import {
  counted,
  grade,
  parseAnswer,
  verdict,
  wrongFlags,
  type Answer,
  type Question
} from './prediction';

const format = (value: number) => value.toString(16).toUpperCase().padStart(4, '0');

describe('parseAnswer', () => {
  it('reads hex as the registers show it, with or without a mark', () => {
    for (const text of ['2A', '2a', '0x2A', '$2A', '2Ah', ' 002A ']) {
      expect(parseAnswer(text, 16), text).toBe(0x2a);
    }
  });

  it('takes a negative number as its two’s complement', () => {
    expect(parseAnswer('-1', 8)).toBe(0xff);
    expect(parseAnswer('-1', 16)).toBe(0xffff);
    expect(parseAnswer('-0x80', 8)).toBe(0x80);
    expect(parseAnswer('-1', 32)).toBe(0xffffffff);
  });

  it('refuses what is not hex or does not fit', () => {
    expect(parseAnswer('', 8)).toBeNull();
    expect(parseAnswer('xyz', 8)).toBeNull();
    expect(parseAnswer('100', 8)).toBeNull();
    expect(parseAnswer('-81', 8)).toBeNull();
    expect(parseAnswer('FFFFFFFF', 32)).toBe(0xffffffff);
    expect(parseAnswer('100000000', 32)).toBeNull();
  });
});

describe('grade', () => {
  const value: Question = { kind: 'value', text: 'add ax, 1', register: 'AX', key: 'ax', bits: 16 };
  const flags: Question = { kind: 'flags', text: 'cmp ax, 1', flags: ['CF', 'ZF'] };
  const branch: Question = { kind: 'branch', text: 'je L3' };

  it('checks a value and says both', () => {
    const truth: Answer = { kind: 'value', value: 10 };
    const wrong = grade(value, { kind: 'value', value: 9 }, truth, null, format);
    expect(wrong.correct).toBe(false);
    expect(verdict(wrong)).toBe('Not quite: AX is 000A; you said 0009.');
    expect(verdict(grade(value, truth, truth, null, format))).toBe('Right: AX is 000A.');
  });

  it('checks every flag of the question', () => {
    const truth: Answer = { kind: 'flags', on: ['ZF'] };
    const answer: Answer = { kind: 'flags', on: ['CF', 'ZF'] };
    expect(wrongFlags(flags, answer, truth)).toEqual(['CF']);
    const outcome = grade(flags, answer, truth, null, format);
    expect(outcome.correct).toBe(false);
    expect(outcome.actual).toBe('CF = 0 and ZF = 1');
    expect(grade(flags, truth, truth, null, format).correct).toBe(true);
  });

  it('checks a branch', () => {
    const taken: Answer = { kind: 'branch', taken: true };
    const not: Answer = { kind: 'branch', taken: false };
    expect(grade(branch, taken, taken, 'why', format)).toMatchObject({ correct: true, why: 'why' });
    expect(verdict(grade(branch, taken, not, null, format))).toBe(
      'Not quite: it fell through; you said it would jump.'
    );
  });

  it('refuses an answer of another kind', () => {
    expect(() =>
      grade(branch, { kind: 'value', value: 1 }, { kind: 'value', value: 1 }, null, format)
    ).toThrow();
  });
});

describe('counted', () => {
  it('counts every answer, and the right ones', () => {
    const right = { correct: true, actual: '', said: '', why: null };
    const tally = counted(counted({ right: 0, asked: 0 }, right), { ...right, correct: false });
    expect(tally).toEqual({ right: 1, asked: 2 });
  });
});
