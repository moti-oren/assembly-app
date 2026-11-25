import { describe, expect, it } from 'vitest';
import type { NumberRequest } from '@/core/representation/request';
import { numbersChoices, withChoice } from './numbersChoices';

const shift: NumberRequest = {
  kind: 'shift',
  width: 8,
  value: 0x81,
  direction: 'left',
  fill: 'zero',
  count: 1
};
const extend: NumberRequest = { kind: 'extend', value: 0x80, from: 8, to: 16, signed: true };

describe('numbersChoices', () => {
  it('offers a fill only for a shift right', () => {
    expect(numbersChoices(shift).map((choice) => choice.id)).toEqual(['direction']);
    const right = withChoice(shift, 'direction', 'right');
    expect(numbersChoices(right).map((choice) => choice.id)).toEqual(['direction', 'fill']);
  });

  it('keeps an extension from starting as wide as it ends', () => {
    const [, from] = numbersChoices(extend);
    expect(from.disabled).toEqual(['16']);
    expect(from.reason).toMatch(/under 16 bits/);
  });

  it('offers nothing for a sum, where nothing is set once', () => {
    expect(numbersChoices({ kind: 'add', width: 8, a: 1, b: 2, extra: 0 })).toEqual([]);
  });
});

describe('withChoice', () => {
  it('makes each choice, and keeps the value inside the bits it starts from', () => {
    expect(withChoice(extend, 'fill', 'zero')).toMatchObject({ signed: false });
    const wide: NumberRequest = { ...extend, value: 0x1234, from: 16, to: 32 };
    expect(withChoice(wide, 'from', '8')).toMatchObject({ from: 8, value: 0x34 });
    const bcd: NumberRequest = { kind: 'bcd', operation: 'add', a: 0x19, b: 0x03, extra: 0 };
    expect(withChoice(bcd, 'operation', 'subtract')).toMatchObject({ operation: 'subtract' });
    expect(withChoice(withChoice(shift, 'direction', 'right'), 'fill', 'sign')).toMatchObject({
      direction: 'right',
      fill: 'sign'
    });
  });
});
