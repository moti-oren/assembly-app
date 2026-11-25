import { describe, expect, it } from 'vitest';
import { solveScaling, type ScalingRequest } from '@/core/representation/scaling';
import { placesText, shiftSummary, withCount, withDirection } from './numbersShift';

const request = (
  value: number,
  direction: ScalingRequest['direction'],
  count = 1,
  fill: ScalingRequest['fill'] = 'zero'
): ScalingRequest => ({ kind: 'shift', width: 8, value, direction, fill, count });

const summaries = (given: ScalingRequest) => {
  const { scales } = solveScaling(given);
  return {
    unsigned: shiftSummary(scales.unsigned, given),
    signed: shiftSummary(scales.signed, given)
  };
};

describe('withCount', () => {
  it('keeps the count between none and every bit', () => {
    expect(withCount(request(1, 'left'), 5).count).toBe(5);
    expect(withCount(request(1, 'left'), -1).count).toBe(0);
    expect(withCount(request(1, 'left'), 9).count).toBe(8);
  });
});

describe('withDirection', () => {
  it('brings only zeros in from the right', () => {
    expect(withDirection(request(1, 'right', 1, 'sign'), 'left')).toMatchObject({
      direction: 'left',
      fill: 'zero'
    });
    expect(withDirection(request(1, 'left'), 'right').fill).toBe('zero');
    expect(withDirection(request(1, 'right', 1, 'sign'), 'right').fill).toBe('sign');
  });
});

describe('placesText', () => {
  it('counts places', () => {
    expect(placesText(1)).toBe('1 place');
    expect(placesText(0)).toBe('0 places');
    expect(placesText(3)).toBe('3 places');
  });
});

describe('shiftSummary', () => {
  it('writes a shift left as a multiplication', () => {
    const { unsigned, signed } = summaries(request(0x15, 'left', 2));
    expect(unsigned).toEqual({
      sum: '21 × 4 = 84',
      agrees: true,
      lead: null,
      verdict: 'Fits in 0 to 255.'
    });
    expect(signed.verdict).toBe('Fits in −128 to 127.');
  });

  it('says where a doubling stops fitting, and what the bits read then', () => {
    const { unsigned, signed } = summaries(request(0xfd, 'left'));
    expect(signed).toMatchObject({ sum: '−3 × 2 = −6', agrees: true });
    expect(unsigned).toEqual({
      sum: '253 × 2 = 506',
      agrees: false,
      lead: 'Does not fit.',
      verdict: 'The range is 0 to 255: the bits read 250.'
    });
  });

  it('writes a shift right as a division that rounds down', () => {
    const { signed } = summaries(request(0xf9, 'right', 1, 'sign'));
    expect(signed).toEqual({
      sum: '−7 ÷ 2 = −4, 1 left over',
      agrees: true,
      lead: null,
      verdict: 'The bits read −4, rounded down.'
    });
  });

  it('says which scale a fill does not halve', () => {
    const zeros = summaries(request(0xf9, 'right'));
    expect(zeros.unsigned).toMatchObject({ sum: '249 ÷ 2 = 124, 1 left over', agrees: true });
    expect(zeros.signed).toMatchObject({
      agrees: false,
      lead: 'Not this scale’s halving.',
      verdict: 'The bits read 124: zeros came in at the top, which halves the unsigned number only.'
    });
    const copies = summaries(request(0xf8, 'right', 1, 'sign'));
    expect(copies.signed).toMatchObject({ sum: '−8 ÷ 2 = −4', verdict: 'The bits read −4.' });
    expect(copies.unsigned.verdict).toBe(
      'The bits read 252: copies of the top bit came in, which halves the signed number only.'
    );
  });

  it('does not write out a factor no CPU register could hold', () => {
    const far = summaries({ ...request(0x81, 'left'), count: 200 });
    expect(far.unsigned.sum).toBe('129 × 2 200 times over');
    const gone = summaries({ ...request(0x81, 'right', 1, 'sign'), count: 200 });
    expect(gone.signed.sum).toBe('−127 ÷ 2 200 times over = −1');
  });
});
