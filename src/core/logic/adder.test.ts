import { describe, expect, it } from 'vitest';
import { ADDER, rippleAdder } from './adder';
import { bitOf, evaluate, numberFrom, type Bit } from './gates';

function run(width: number, a: number, b: number, sub: Bit, carryIn: Bit) {
  const inputs: Record<string, Bit> = { [ADDER.sub]: sub, [ADDER.carry(0)]: carryIn };
  for (let bit = 0; bit < width; bit++) {
    inputs[ADDER.a(bit)] = bitOf(a, bit);
    inputs[ADDER.b(bit)] = bitOf(b, bit);
  }
  const signals = evaluate(rippleAdder(width), inputs);
  return { sum: numberFrom(signals, ADDER.sum, width), carryOut: signals[ADDER.carry(width)] };
}

describe('rippleAdder', () => {
  it('has six gates per bit', () => {
    expect(rippleAdder(8).gates).toHaveLength(48);
  });

  it('adds every pair of 4-bit numbers, with and without a carry in', () => {
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        for (const carryIn of [0, 1] as const) {
          const exact = a + b + carryIn;
          expect(run(4, a, b, 0, carryIn)).toEqual({ sum: exact & 0xf, carryOut: exact >> 4 });
        }
      }
    }
  });

  it('subtracts every pair of 4-bit numbers as a + NOT b + 1', () => {
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        // The carry out is 1 exactly when no borrow was needed.
        expect(run(4, a, b, 1, 1)).toEqual({ sum: (a - b) & 0xf, carryOut: a >= b ? 1 : 0 });
      }
    }
  });

  it('ripples a carry through all 32 bits', () => {
    expect(run(32, 0xffffffff, 1, 0, 0)).toEqual({ sum: 0, carryOut: 1 });
  });
});
