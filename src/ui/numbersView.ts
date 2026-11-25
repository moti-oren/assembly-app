import {
  hasNumbers,
  reads,
  shiftReadings,
  type FlagReading,
  type NumberLink,
  type NumberView
} from '@/core/numberLink';
import { isDecimalByte, wrap, type Width } from '@/core/representation/readings';
import { resultOf, type NumberRequest, type NumberSolution } from '@/core/representation/request';
import { hexOf, WIDTHS } from './logicView';

/** What the number topic can show, whether or not a CPU asked for it. */
export const LENSES = [
  { id: 'add', label: 'Add' },
  { id: 'subtract', label: 'Subtract' },
  { id: 'shift', label: 'Shift' },
  { id: 'extend', label: 'Extend' },
  { id: 'bcd', label: 'Decimal' },
  { id: 'value', label: 'One value' }
] as const;

export type LensId = (typeof LENSES)[number]['id'];

/** An input the learner can change. */
export type OperandKey = 'a' | 'b';

/** How wide the row of bits a request ends in is. */
export function widthOf(request: NumberRequest): Width {
  if (request.kind === 'extend') return request.to;
  return request.kind === 'bcd' ? 8 : request.width;
}

/** Whether a request can be made `width` bits wide: a decimal byte is 8, an extension over 8. */
export function widthAllowed(request: NumberRequest, width: Width): boolean {
  if (request.kind === 'bcd') return false;
  return request.kind !== 'extend' || width > 8;
}

/** Why a width picker has widths it will not take, in words; null where it takes them all. */
export function widthReason(request: NumberRequest): string | null {
  if (request.kind === 'bcd') return 'Packed decimal is one byte: two digits in 8 bits.';
  return request.kind === 'extend'
    ? 'An extension ends wider than the 8 bits it starts from.'
    : null;
}

/** The widths a request cannot be made: what a width picker shows as off. */
export function disallowedWidths(request: NumberRequest): Width[] {
  return WIDTHS.filter((width) => !widthAllowed(request, width));
}

/** The request's inputs, whatever it calls them; null where it has no second one. */
function operandsOf(request: NumberRequest): { a: number; b: number | null } {
  switch (request.kind) {
    case 'extend':
      return { a: request.value, b: null };
    case 'value':
      return { a: request.bits, b: null };
    case 'shift':
      return { a: request.value, b: null };
    default:
      return { a: request.a, b: request.b };
  }
}

/** A whole number as it is written by hand: grouped in thousands, with a real minus sign. */
export const numberText = (value: number): string =>
  value.toLocaleString('en-US').replace('-', '−');

/** A value as a row of bits, bit 0 first. */
export function bitsOf(value: number, width: number): (0 | 1)[] {
  return Array.from({ length: width }, (_, bit) => (Math.floor(value / 2 ** bit) % 2 ? 1 : 0));
}

/** A byte to start a decimal sum from: the one given when it is two digits, else a plain one. */
const decimalByte = (value: number, otherwise: number): number =>
  isDecimalByte(value & 0xff) ? value & 0xff : otherwise;

/** A request for `lens`, keeping the operands of `from` as far as they fit. */
export function freeRequest(lens: LensId, width: Width, from: NumberRequest | null): NumberRequest {
  const given = from ? operandsOf(from) : { a: 0x7f, b: 0x01 };
  const a = wrap(given.a, width);
  const b = wrap(given.b ?? 1, width);
  switch (lens) {
    case 'add':
    case 'subtract':
      return { kind: lens, width, a, b, extra: 0 };
    case 'extend': {
      const to = width === 8 ? 16 : width;
      const narrow = from?.kind === 'extend' && from.from < to ? from.from : 8;
      // A value whose top bit is 0 extends the same both ways: one that shows the difference
      // starts the lens, unless it came from an extension already.
      const top = 2 ** (narrow - 1);
      const carried = wrap(from ? given.a : top, narrow);
      return {
        kind: 'extend',
        value: from?.kind === 'extend' || carried >= top ? carried : top,
        from: narrow,
        to,
        signed: from?.kind === 'extend' ? from.signed : true
      };
    }
    case 'shift':
      return {
        kind: 'shift',
        width,
        value: a,
        direction: from?.kind === 'shift' ? from.direction : 'left',
        fill: from?.kind === 'shift' ? from.fill : 'zero',
        count: from?.kind === 'shift' ? Math.min(from.count, width) : 1
      };
    case 'bcd':
      return {
        kind: 'bcd',
        operation: from?.kind === 'subtract' ? 'subtract' : 'add',
        a: decimalByte(given.a, 0x19),
        b: decimalByte(given.b ?? 0x03, 0x03),
        extra: 0
      };
    case 'value':
      return { kind: 'value', width, bits: a };
  }
}

/** A request no CPU made as a view: its flags go by their plain names. */
export function freeView(request: NumberRequest): NumberView {
  const result = [reads('Zero', 'unsigned', 'zero'), reads('Negative', 'signed', 'negative')];
  const flags: Record<NumberRequest['kind'], FlagReading[]> = {
    add: [reads('Carry', 'unsigned', 'outside'), reads('Overflow', 'signed', 'outside'), ...result],
    subtract: [
      reads('Borrow', 'unsigned', 'outside'),
      reads('Overflow', 'signed', 'outside'),
      ...result
    ],
    bcd: [
      reads(
        request.kind === 'bcd' && request.operation === 'subtract' ? 'Borrow' : 'Carry',
        'decimal',
        'outside'
      )
    ],
    shift:
      request.kind === 'shift'
        ? shiftReadings(request, {
            carry: 'Carry',
            overflow: 'Overflow',
            zero: 'Zero',
            negative: 'Negative'
          })
        : [],
    extend: [],
    value: []
  };
  return { request, flags: flags[request.kind], resultKept: true, comparable: true, note: null };
}

/** Whether two requests are the same operation, with only the values put into it differing. */
export function sameOperation(one: NumberRequest, other: NumberRequest): boolean {
  if (one.kind !== other.kind || widthOf(one) !== widthOf(other)) return false;
  if (one.kind === 'extend' && other.kind === 'extend') {
    return one.from === other.from && one.signed === other.signed;
  }
  if (one.kind === 'bcd' && other.kind === 'bcd') return one.operation === other.operation;
  if (one.kind === 'shift' && other.kind === 'shift') {
    return (
      one.direction === other.direction && one.fill === other.fill && one.count === other.count
    );
  }
  return true;
}

/** The request with one of its inputs given a new value, kept to the bits it has. */
export function withOperand(
  request: NumberRequest,
  operand: OperandKey,
  value: number
): NumberRequest {
  switch (request.kind) {
    case 'extend':
      return { ...request, value: wrap(value, request.from) };
    case 'value':
      return { ...request, bits: wrap(value, request.width) };
    case 'shift':
      return { ...request, value: wrap(value, request.width) };
    default: {
      const bits = wrap(value, widthOf(request));
      return operand === 'a' ? { ...request, a: bits } : { ...request, b: bits };
    }
  }
}

/** The request with one bit of an input flipped. */
export function withBitFlipped(
  request: NumberRequest,
  operand: OperandKey,
  bit: number
): NumberRequest {
  const { a, b } = operandsOf(request);
  const value = operand === 'a' ? a : (b ?? 0);
  const flipped = Math.floor(value / 2 ** bit) % 2 === 1 ? value - 2 ** bit : value + 2 ** bit;
  return withOperand(request, operand, flipped);
}

/** The request with its carry or borrow coming in flipped, where it has one. */
export function withExtraFlipped(request: NumberRequest): NumberRequest {
  if (request.kind === 'extend' || request.kind === 'value' || request.kind === 'shift') {
    return request;
  }
  return { ...request, extra: request.extra ? 0 : 1 };
}

const decimalText = (byte: number): string => byte.toString(16).toUpperCase().padStart(2, '0');

/** The operation on one line: `0x7F + 0x01 = 0x80`. */
export function equationText(request: NumberRequest, solution: NumberSolution): string {
  const result = resultOf(solution);
  switch (request.kind) {
    case 'add':
    case 'subtract': {
      const sign = request.kind === 'add' ? '+' : '−';
      const hex = (value: number) => hexOf(value, request.width);
      const extra = request.extra ? ` ${sign} 1` : '';
      return `${hex(request.a)} ${sign} ${hex(request.b)}${extra} = ${hex(result)}`;
    }
    case 'extend': {
      const narrow = `0x${wrap(request.value, request.from)
        .toString(16)
        .toUpperCase()
        .padStart(request.from / 4, '0')}`;
      const how = request.signed ? 'copying the top bit' : 'filling with zeros';
      return `${narrow} → ${hexOf(result, request.to)}, ${how}`;
    }
    case 'bcd': {
      const sign = request.operation === 'add' ? '+' : '−';
      const extra = request.extra ? ` ${sign} 1` : '';
      return `${decimalText(request.a)} ${sign} ${decimalText(request.b)}${extra} = ${decimalText(result)} in decimal digits`;
    }
    case 'shift': {
      const sign = request.direction === 'left' ? '<<' : '>>';
      const how =
        request.direction === 'right' && request.fill === 'sign' ? ', copying the top bit' : '';
      return `${hexOf(request.value, request.width)} ${sign} ${request.count} = ${hexOf(result, request.width)}${how}`;
    }
    case 'value':
      return hexOf(result, request.width);
  }
}

/** What is on show, in a few words: `8-bit sum, on two scales`. */
export function lensTitle(request: NumberRequest): string {
  switch (request.kind) {
    case 'add':
      return `${request.width}-bit sum, read two ways`;
    case 'subtract':
      return `${request.width}-bit difference, read two ways`;
    case 'extend':
      return `${request.from} bits made ${request.to}`;
    case 'bcd':
      return 'Two decimal digits in a byte';
    case 'shift':
      return `${request.width} bits moved ${request.direction}, read two ways`;
    case 'value':
      return `${request.width} bits, read every way`;
  }
}

/**
 * Whether the CPU left a flag saying the answer did not fit on each scale, unsigned and signed.
 * RISC-V keeps no flags, and some instructions leave one as it was (INC and DEC keep the carry).
 */
export function flagsBothScales(view: NumberView): boolean {
  const fits = view.flags.filter((reading) => reading.verdict === 'outside');
  const scales = new Set(fits.map((reading) => reading.scale));
  return scales.has('unsigned') && scales.has('signed');
}

/** One or two sentences on what the lens teaches; `bothFlags` from `flagsBothScales`. */
export function lensLesson(request: NumberRequest, bothFlags: boolean): string {
  switch (request.kind) {
    case 'add':
    case 'subtract':
      return `The bits do not say whether they are signed. Each wheel reads the same bits on one scale: a step past the end of a wheel is where that scale’s answer stops fitting${bothFlags ? ', and the CPU keeps a flag for each' : ''}.`;
    case 'extend':
      return 'A narrow value has to fill a wider register. Copying its top bit into the new places keeps the signed number; filling them with zeros keeps the unsigned one.';
    case 'bcd':
      return 'Each half of the byte is one decimal digit. The halves are added in binary, and a half that is no longer a digit is put right by 6, the six values four bits have beyond 9.';
    case 'shift':
      return 'Every place to the left doubles a number and every place to the right halves it, as moving the digits of a decimal number multiplies or divides it by ten. Halving has to know the scale: zeros in the emptied places halve the unsigned number, copies of the top bit halve the signed one. Either way it rounds down, so −7 halved is −4, where a division instruction would give −3.';
    case 'value':
      return 'A row of bits means nothing by itself: the instruction that uses it decides how it is read.';
  }
}

/** Why the CPU's last instruction has no numbers to show, when it has none. */
export function unavailableText(link: NumberLink | null): string | null {
  return link && !hasNumbers(link)
    ? `${link.unavailable} The numbers on show are ones to try by hand.`
    : null;
}

/**
 * Where a decimal digit's one more comes from: the tens get it from the ones, the ones from the
 * carry (or the borrow) coming into the byte.
 */
export function bcdExtraFrom(place: 'ones' | 'tens', adding: boolean): string {
  if (place === 'tens') return adding ? 'carried from the ones' : 'borrowed by the ones';
  return adding ? 'the carry coming in' : 'the borrow coming in';
}
