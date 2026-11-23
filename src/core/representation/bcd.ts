import { decimalOf, isDecimalByte } from './readings';

/** A sum or a difference of two bytes that each hold two decimal digits. */
export interface BcdRequest {
  kind: 'bcd';
  operation: 'add' | 'subtract';
  a: number;
  b: number;
  /** One more added, or one more taken off: a carry or a borrow coming in. */
  extra: 0 | 1;
}

/** One decimal digit of the operation: four bits worked out in binary, then put right. */
export interface BcdDigit {
  place: 'ones' | 'tens';
  a: number;
  b: number;
  /** The carry or borrow from the digit below. */
  extra: 0 | 1;
  /** The plain binary sum or difference of the two digits. */
  raw: number;
  /** True when the raw answer is not a decimal digit, so 6 is added or taken off. */
  corrected: boolean;
  digit: number;
  /** The carry or borrow handed to the digit above. */
  out: 0 | 1;
}

export interface BcdSolution {
  request: BcdRequest;
  digits: [ones: BcdDigit, tens: BcdDigit];
  result: number;
  /** The carry out of a sum, or the borrow out of a difference. */
  out: 0 | 1;
  /** The operation as decimal numbers, or null when an operand is not one. */
  decimal: { a: number; b: number; exact: number; shown: number } | null;
}

/** Sixteen values fit in four bits and only ten are digits: 6 is the gap that is skipped. */
const GAP = 6;

function digit(
  place: BcdDigit['place'],
  operation: BcdRequest['operation'],
  a: number,
  b: number,
  extra: 0 | 1
): BcdDigit {
  const adding = operation === 'add';
  const raw = adding ? a + b + extra : a - b - extra;
  const corrected = adding ? raw > 9 : raw < 0;
  const adjusted = corrected ? (adding ? raw + GAP : raw - GAP) : raw;
  return { place, a, b, extra, raw, corrected, digit: adjusted & 0x0f, out: corrected ? 1 : 0 };
}

export function solveBcd(request: BcdRequest): BcdSolution {
  const { operation, a, b, extra } = request;
  const ones = digit('ones', operation, a & 0x0f, b & 0x0f, extra);
  const tens = digit('tens', operation, (a >> 4) & 0x0f, (b >> 4) & 0x0f, ones.out);
  const result = (tens.digit << 4) | ones.digit;
  const valid = isDecimalByte(a) && isDecimalByte(b);
  const sign = operation === 'add' ? 1 : -1;
  return {
    request,
    digits: [ones, tens],
    result,
    out: tens.out,
    decimal: valid
      ? {
          a: decimalOf(a),
          b: decimalOf(b),
          exact: decimalOf(a) + sign * (decimalOf(b) + extra),
          shown: decimalOf(result)
        }
      : null
  };
}
