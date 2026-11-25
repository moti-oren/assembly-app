import { describe, expect, it } from 'vitest';
import { reads, type NumberView } from '@/core/numberLink';
import { solveArithmetic, type ArithmeticRequest } from '@/core/representation/arithmetic';
import { flagRows, scaleSummary, scalesSaid } from './numbersFlags';

const request: ArithmeticRequest = { kind: 'add', width: 8, a: 0x7f, b: 0x01, extra: 0 };

describe('flagRows', () => {
  it('gives each flag its value and what it says', () => {
    const view: NumberView = {
      request,
      flags: [reads('CF', 'unsigned', 'outside'), reads('OF', 'signed', 'outside')],
      resultKept: true,
      comparable: true,
      note: null
    };
    expect(flagRows(view, solveArithmetic(request))).toEqual([
      {
        flag: 'CF',
        value: 0,
        scale: 'unsigned',
        meaning: '1 when the unsigned answer does not fit'
      },
      { flag: 'OF', value: 1, scale: 'signed', meaning: '1 when the signed answer does not fit' }
    ]);
  });

  it('says a flag that works backwards the other way round', () => {
    const compare: ArithmeticRequest = { kind: 'subtract', width: 8, a: 5, b: 3, extra: 0 };
    const view: NumberView = {
      request: compare,
      flags: [reads('C', 'unsigned', 'below', true)],
      resultKept: false,
      comparable: true,
      note: null
    };
    expect(flagRows(view, solveArithmetic(compare))[0]).toMatchObject({
      value: 1,
      meaning: '1 unless A is less than B on the unsigned scale'
    });
  });
});

describe('scaleSummary', () => {
  it('says the answer fits, with its range', () => {
    const { unsigned } = solveArithmetic(request);
    expect(scaleSummary(unsigned, 'add', 0)).toEqual({
      sum: '127 + 1 = 128',
      fits: true,
      verdict: 'Fits in 0 to 255.'
    });
  });

  it('says what the bits read when it does not', () => {
    const { signed } = solveArithmetic(request);
    expect(scaleSummary(signed, 'add', 0).verdict).toBe(
      'Does not fit in −128 to 127: the bits read −128.'
    );
  });

  it('sets a negative second number in brackets, and counts the borrow', () => {
    const { signed } = solveArithmetic({ kind: 'subtract', width: 8, a: 1, b: 0xff, extra: 1 });
    expect(scaleSummary(signed, 'subtract', 1).sum).toBe('1 − (−1) − 1 = 1');
  });
});

describe('scalesSaid', () => {
  it('says each scale, its sum and its verdict', () => {
    const summary = { sum: '255 + 1 = 256', fits: false, verdict: 'Does not fit in 0 to 255.' };
    expect(scalesSaid([{ scale: 'unsigned', summary }])).toBe(
      'unsigned: 255 + 1 = 256. Does not fit in 0 to 255.'
    );
  });
});
