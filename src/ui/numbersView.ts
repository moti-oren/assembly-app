import { reads, type FlagReading, type NumberView } from '@/core/numberLink';
import { isDecimalByte, wrap, type Width } from '@/core/representation/readings';
import { resultOf, type NumberRequest, type NumberSolution } from '@/core/representation/request';
import { hexOf } from './logicView';

/** What the number topic can show, whether or not a CPU asked for it. */
export const LENSES = [
  { id: 'add', label: 'Add' },
  { id: 'subtract', label: 'Subtract' },
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

/** The request's inputs, whatever it calls them; null where it has no second one. */
function operandsOf(request: NumberRequest): { a: number; b: number | null } {
  switch (request.kind) {
    case 'extend':
      return { a: request.value, b: null };
    case 'value':
      return { a: request.bits, b: null };
    default:
      return { a: request.a, b: request.b };
  }
}

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
      return {
        kind: 'extend',
        value: wrap(from ? given.a : 0x80, narrow),
        from: narrow,
        to,
        signed: from?.kind === 'extend' ? from.signed : true
      };
    }
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
    extend: [],
    value: []
  };
  return { request, flags: flags[request.kind], resultKept: true, note: null };
}

/** Whether two requests are the same operation, with only the values put into it differing. */
export function sameOperation(one: NumberRequest, other: NumberRequest): boolean {
  if (one.kind !== other.kind || widthOf(one) !== widthOf(other)) return false;
  if (one.kind === 'extend' && other.kind === 'extend') {
    return one.from === other.from && one.signed === other.signed;
  }
  if (one.kind === 'bcd' && other.kind === 'bcd') return one.operation === other.operation;
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
  if (request.kind === 'extend' || request.kind === 'value') return request;
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
    case 'value':
      return `${request.width} bits, read every way`;
  }
}

/** One or two sentences on what the lens teaches. */
export function lensLesson(request: NumberRequest): string {
  switch (request.kind) {
    case 'add':
    case 'subtract':
      return 'The bits do not say whether they are signed. Each wheel reads the same bits on one scale: a step past the end of a wheel is where that scale’s answer stops fitting, and the CPU keeps a flag for each.';
    case 'extend':
      return 'A narrow value has to fill a wider register. Copying its top bit into the new places keeps the signed number; filling them with zeros keeps the unsigned one.';
    case 'bcd':
      return 'Each half of the byte is one decimal digit. The halves are added in binary, and a half that is no longer a digit is put right by 6, the six values four bits have beyond 9.';
    case 'value':
      return 'A row of bits means nothing by itself: the instruction that uses it decides how it is read.';
  }
}
