import type { ScaleScaling, ScalingRequest } from '@/core/representation/scaling';
import { numberText } from './numbersView';

/** The two ways to move the bits, and what each does to a number. */
export const DIRECTIONS = [
  { id: 'left', label: 'Left: × 2' },
  { id: 'right', label: 'Right: ÷ 2' }
] as const;

/** What comes into the places a shift right leaves empty. */
export const FILLS = [
  { id: 'zero', label: 'Fill with zeros' },
  { id: 'sign', label: 'Copy the top bit' }
] as const;

/** The request moved another number of places: none at least, every bit at most. */
export function withCount(request: ScalingRequest, count: number): ScalingRequest {
  return { ...request, count: Math.min(Math.max(count, 0), request.width) };
}

/** The request the other way; a shift left has only zeros to bring in. */
export function withDirection(
  request: ScalingRequest,
  direction: ScalingRequest['direction']
): ScalingRequest {
  return { ...request, direction, fill: direction === 'left' ? 'zero' : request.fill };
}

/** `3 places`, `1 place`. */
export function placesText(count: number): string {
  return `${count} ${count === 1 ? 'place' : 'places'}`;
}

/** One scale's reading of a shift: the multiplication or division, and what became of it. */
export interface ShiftSummary {
  /** `−7 ÷ 2 = −4, 1 left over` */
  sum: string;
  /** Whether the bits say the true answer on this scale. */
  agrees: boolean;
  /** What went wrong in two or three words, where the bits do not say the answer. */
  lead: string | null;
  verdict: string;
}

/** A CPU may shift by more places than a number this large can be written out for. */
const WRITTEN_OUT = 32;

function sumText(scale: ScaleScaling, { direction, count }: ScalingRequest): string {
  const sign = direction === 'left' ? '×' : '÷';
  const start = `${numberText(scale.value)} ${sign}`;
  if (count > WRITTEN_OUT) {
    return direction === 'left'
      ? `${start} 2 ${count} times over`
      : `${start} 2 ${count} times over = ${numberText(scale.exact)}`;
  }
  const over = scale.remainder ? `, ${numberText(scale.remainder)} left over` : '';
  return `${start} ${numberText(2 ** count)} = ${numberText(scale.exact)}${over}`;
}

const WRONG_FILL: Record<ScalingRequest['fill'], string> = {
  zero: 'zeros came in at the top, which halves the unsigned number only',
  sign: 'copies of the top bit came in, which halves the signed number only'
};

export function shiftSummary(scale: ScaleScaling, request: ScalingRequest): ShiftSummary {
  const sum = sumText(scale, request);
  const shown = numberText(scale.shown);
  const range = `${numberText(scale.range.min)} to ${numberText(scale.range.max)}`;
  if (request.direction === 'left') {
    return scale.fits
      ? { sum, agrees: true, lead: null, verdict: `Fits in ${range}.` }
      : {
          sum,
          agrees: false,
          lead: 'Does not fit.',
          verdict: `The range is ${range}: the bits read ${shown}.`
        };
  }
  if (scale.agrees) {
    const rounded = scale.remainder ? ', rounded down' : '';
    return { sum, agrees: true, lead: null, verdict: `The bits read ${shown}${rounded}.` };
  }
  return {
    sum,
    agrees: false,
    lead: 'Not this scale’s halving.',
    verdict: `The bits read ${shown}: ${WRONG_FILL[request.fill]}.`
  };
}
