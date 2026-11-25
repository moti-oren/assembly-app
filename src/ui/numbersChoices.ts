import type { NumberRequest } from '@/core/representation/request';
import { DIRECTIONS, FILLS as SHIFT_FILLS, withDirection } from './numbersShift';

/**
 * The choices of a lens that are set once and then watched (which way, what fills, add or
 * take off), as the sidebar offers them. What is pressed again and again, a bit or a count,
 * stays beside the drawing.
 */
export interface NumbersChoice {
  id: string;
  label: string;
  choices: readonly { id: string; label: string }[];
  chosen: string;
  /** The choices that cannot be picked for what is on show. */
  disabled: string[];
  /** Why some cannot be picked, said under them: a disabled button cannot say it itself. */
  reason?: string;
}

const EXTENSION_FILLS = [
  { id: 'sign', label: 'Copy the top bit' },
  { id: 'zero', label: 'Fill with zeros' }
] as const;

const NARROW = [8, 16] as const;

const OPERATIONS = [
  { id: 'add', label: 'Add' },
  { id: 'subtract', label: 'Subtract' }
] as const;

/** The choices the request on show has: none for a sum, a difference or a value. */
export function numbersChoices(request: NumberRequest): NumbersChoice[] {
  switch (request.kind) {
    case 'bcd':
      return [
        {
          id: 'operation',
          label: 'Add or subtract',
          choices: OPERATIONS,
          chosen: request.operation,
          disabled: []
        }
      ];
    case 'extend':
      return [
        {
          id: 'fill',
          label: 'The new bits',
          choices: EXTENSION_FILLS,
          chosen: request.signed ? 'sign' : 'zero',
          disabled: []
        },
        {
          id: 'from',
          label: 'Bits of the value',
          choices: NARROW.map((bits) => ({ id: String(bits), label: `From ${bits} bits` })),
          chosen: String(request.from),
          disabled: NARROW.filter((bits) => bits >= request.to).map(String),
          reason:
            request.to <= 16
              ? `A value is made wider: it starts under ${request.to} bits.`
              : undefined
        }
      ];
    case 'shift':
      return [
        {
          id: 'direction',
          label: 'Which way the bits move',
          choices: DIRECTIONS,
          chosen: request.direction,
          disabled: []
        },
        // A shift left has only zeros to bring in, so it has no fill to choose.
        ...(request.direction === 'right'
          ? [
              {
                id: 'fill',
                label: 'What comes into the emptied places',
                choices: SHIFT_FILLS,
                chosen: request.fill,
                disabled: []
              }
            ]
          : [])
      ];
    default:
      return [];
  }
}

/** The request with one choice made: the one with that `id`, set to `value`. */
export function withChoice(request: NumberRequest, id: string, value: string): NumberRequest {
  if (request.kind === 'bcd' && id === 'operation') {
    return { ...request, operation: value === 'subtract' ? 'subtract' : 'add' };
  }
  if (request.kind === 'extend' && id === 'fill') return { ...request, signed: value === 'sign' };
  if (request.kind === 'extend' && id === 'from') {
    const from = Number(value) === 16 ? 16 : 8;
    return { ...request, from, value: request.value % 2 ** from };
  }
  if (request.kind === 'shift' && id === 'direction') {
    return withDirection(request, value === 'right' ? 'right' : 'left');
  }
  if (request.kind === 'shift' && id === 'fill') {
    return { ...request, fill: value === 'sign' ? 'sign' : 'zero' };
  }
  return request;
}
