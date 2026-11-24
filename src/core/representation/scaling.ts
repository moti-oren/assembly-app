import {
  rangeOf,
  readAs,
  signedOf,
  span,
  wrap,
  type Range,
  type Scale,
  type Width
} from './readings';

/** A row of bits moved along: each place to the left doubles a number, each to the right halves it. */
export interface ScalingRequest {
  kind: 'shift';
  width: Width;
  value: number;
  direction: 'left' | 'right';
  /** What comes into the places a shift right leaves empty: zeros, or copies of the top bit. */
  fill: 'zero' | 'sign';
  /** How many places. A CPU may ask for more than there are bits. */
  count: number;
}

/** The shift as plain arithmetic on one scale. */
export interface ScaleScaling {
  scale: Scale;
  value: number;
  /**
   * The true answer as a whole number: the value times 2 for every place to the left, or divided
   * by 2 for every place to the right and rounded down.
   */
  exact: number;
  /** What a division left over; 0 when shifting left. */
  remainder: number;
  /** What the bits of the result say on this scale. */
  shown: number;
  range: Range;
  /** False when the true answer is outside the range, which only a shift left can do. */
  fits: boolean;
  /** Whether the bits say the true answer. */
  agrees: boolean;
}

export interface ScalingSolution {
  request: ScalingRequest;
  /** The bits of the result. */
  result: number;
  scales: Record<Scale, ScaleScaling>;
}

/** The bits a shift leaves, worked out as a multiplication or a division of whole numbers. */
function resultOf({ width, value, direction, fill, count }: ScalingRequest): number {
  const bits = wrap(value, width);
  if (direction === 'left') return count >= width ? 0 : wrap(bits * span(count), width);
  const read = fill === 'sign' ? signedOf(bits, width) : bits;
  return wrap(Math.floor(read / span(count)), width);
}

function onScale(request: ScalingRequest, scale: Scale, result: number): ScaleScaling {
  const { width, direction, count } = request;
  const value = readAs(request.value, width, scale);
  const factor = span(count);
  const exact = direction === 'left' ? value * factor : Math.floor(value / factor);
  const range = rangeOf(width, scale);
  const shown = readAs(result, width, scale);
  return {
    scale,
    value,
    exact,
    remainder: direction === 'left' ? 0 : value - exact * factor,
    shown,
    range,
    fits: exact >= range.min && exact <= range.max,
    agrees: shown === exact
  };
}

/**
 * Works the shift out as whole numbers, once on each scale. A shift left is right on a scale
 * while the answer fits; a shift right is right on the scale its fill belongs to.
 */
export function solveScaling(request: ScalingRequest): ScalingSolution {
  const result = resultOf(request);
  return {
    request,
    result,
    scales: {
      unsigned: onScale(request, 'unsigned', result),
      signed: onScale(request, 'signed', result)
    }
  };
}
