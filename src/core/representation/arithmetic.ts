import { rangeOf, readAs, wrap, type Range, type Scale, type Width } from './readings';

/** A sum or a difference of two rows of bits. */
export interface ArithmeticRequest {
  kind: 'add' | 'subtract';
  width: Width;
  a: number;
  b: number;
  /** One more added, or one more taken off: a carry or a borrow coming in. */
  extra: 0 | 1;
}

/** The operation as plain arithmetic on one scale, before the result is cut to the width. */
export interface ScaleSolution {
  scale: Scale;
  a: number;
  b: number;
  /** The true answer, which may not fit. */
  exact: number;
  /** What the bits of the result say on this scale. */
  shown: number;
  range: Range;
  /** False when the true answer is outside the range, so the result wrapped around. */
  fits: boolean;
}

export interface ArithmeticSolution {
  request: ArithmeticRequest;
  /** The bits of the result. */
  result: number;
  unsigned: ScaleSolution;
  signed: ScaleSolution;
}

function onScale(request: ArithmeticRequest, scale: Scale, result: number): ScaleSolution {
  const { kind, width, extra } = request;
  const a = readAs(request.a, width, scale);
  const b = readAs(request.b, width, scale);
  const exact = kind === 'add' ? a + b + extra : a - b - extra;
  const range = rangeOf(width, scale);
  return {
    scale,
    a,
    b,
    exact,
    shown: readAs(result, width, scale),
    range,
    fits: exact >= range.min && exact <= range.max
  };
}

/**
 * Works the operation out as whole numbers, once on each scale. The same bits come out either
 * way; what differs is whether the true answer still fits.
 */
export function solveArithmetic(request: ArithmeticRequest): ArithmeticSolution {
  const { kind, width, extra } = request;
  const a = wrap(request.a, width);
  const b = wrap(request.b, width);
  const result = wrap(kind === 'add' ? a + b + extra : a - b - extra, width);
  return {
    request,
    result,
    unsigned: onScale(request, 'unsigned', result),
    signed: onScale(request, 'signed', result)
  };
}
