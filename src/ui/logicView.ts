import { hasCircuit, resultTaps, tap, type AluCircuit, type AluLink } from '@/core/aluLink';
import type { AluRequest, ShiftRequest, Width } from '@/core/logic/alu';
import type { Bit } from '@/core/logic/gates';
import { barrelStages } from '@/core/logic/shifter';
import { PREFIXED, type HexStyle } from './hexNotation';
import type { TopicSectionInfo } from './topicSections';

export const WIDTHS: readonly Width[] = [8, 16, 32];

/** The operations the logic topic offers when it is not following a CPU. */
export const FREE_OPERATIONS = [
  { id: 'add', label: 'Add' },
  { id: 'subtract', label: 'Subtract' },
  { id: 'and', label: 'AND' },
  { id: 'or', label: 'OR' },
  { id: 'xor', label: 'XOR' },
  { id: 'shiftLeft', label: 'Shift left' },
  { id: 'shiftRight', label: 'Shift right' }
] as const;

export type FreeOperation = (typeof FREE_OPERATIONS)[number]['id'];

/** An input of the circuit the learner can change a bit of. */
export type OperandKey = 'a' | 'b';

const maskOf = (width: Width): number => 2 ** width - 1;

/** The request's first operand, whatever the operation calls it. */
function firstOperand(request: AluRequest): number {
  return request.kind === 'shift' ? request.value : request.a;
}

/** Which of the offered operations a request is, or null for one only a CPU makes. */
export function operationOf(request: AluRequest): FreeOperation | null {
  if (request.kind !== 'shift') return request.kind;
  if (request.fill !== 'zero') return null;
  return request.direction === 'left' ? 'shiftLeft' : 'shiftRight';
}

/** A request for `operation`, keeping the operands of `from` as far as they fit. */
export function freeRequest(
  operation: FreeOperation,
  width: Width,
  from: AluRequest | null
): AluRequest {
  const fit = (value: number) => (value & maskOf(width)) >>> 0;
  const a = fit(from ? firstOperand(from) : 0b0101_0110);
  const b = fit(from && from.kind !== 'shift' ? from.b : 0b0011_0011);
  switch (operation) {
    case 'add':
      return { kind: 'add', width, a, b, carryIn: 0 };
    case 'subtract':
      return { kind: 'subtract', width, a, b, carryIn: 1 };
    case 'and':
    case 'or':
    case 'xor':
      return { kind: operation, width, a, b };
    case 'shiftLeft':
    case 'shiftRight':
      return {
        kind: 'shift',
        width,
        value: a,
        direction: operation === 'shiftLeft' ? 'left' : 'right',
        fill: 'zero',
        carryIn: 0,
        stages: barrelStages(1, width)
      };
  }
}

/** The circuit of a request no CPU made: its flags go by their plain names. */
export function freeCircuit(request: AluRequest): AluCircuit {
  const result = resultTaps('Zero', 'Negative');
  const taps =
    request.kind === 'shift'
      ? [tap('Carry', 'carry'), ...result]
      : request.kind === 'add' || request.kind === 'subtract'
        ? [tap('Carry out', 'carryOut'), tap('Overflow', 'overflow'), ...result]
        : result;
  return { request, taps, cleared: [], resultKept: true, note: null };
}

/** Whether two requests are the same circuit, with only the values on its inputs differing. */
export function sameCircuit(one: AluRequest, other: AluRequest): boolean {
  if (one.kind !== other.kind) return false;
  return sameGates(one, other);
}

/**
 * Whether two requests run on the same gates, so a gate broken in one is broken in the other: the
 * adder subtracts on its own gates, with its `sub` line on.
 */
export function sameGates(one: AluRequest, other: AluRequest): boolean {
  const gates = (kind: AluRequest['kind']) => (kind === 'subtract' ? 'add' : kind);
  if (gates(one.kind) !== gates(other.kind) || one.width !== other.width) return false;
  if (one.kind !== 'shift' || other.kind !== 'shift') return true;
  return (
    one.direction === other.direction &&
    one.fill === other.fill &&
    one.stages.length === other.stages.length &&
    one.stages.every((stage, index) => stage.distance === other.stages[index].distance)
  );
}

/** The request with one bit of an operand flipped. */
export function withBitFlipped(request: AluRequest, operand: OperandKey, bit: number): AluRequest {
  const flip = (value: number) => (value ^ (2 ** bit)) >>> 0;
  if (request.kind === 'shift') return { ...request, value: flip(request.value) };
  return operand === 'a' ? { ...request, a: flip(request.a) } : { ...request, b: flip(request.b) };
}

/** The request with its carry in flipped; a logic operation has none. */
export function withCarryInFlipped(request: AluRequest): AluRequest {
  switch (request.kind) {
    case 'add':
    case 'subtract':
      return { ...request, carryIn: (request.carryIn ^ 1) as Bit };
    case 'shift':
      return { ...request, carryIn: (request.carryIn ^ 1) as Bit };
    default:
      return request;
  }
}

/** The shift with one of its rows switched on or off. */
export function withStageFlipped(request: ShiftRequest, index: number): ShiftRequest {
  return {
    ...request,
    stages: request.stages.map((stage, at) =>
      at === index ? { ...stage, on: (stage.on ^ 1) as Bit } : stage
    )
  };
}

/** A value in hex, a digit for every four bits of its width, written in `style`. */
export function hexOf(value: number, width: number, style: HexStyle = PREFIXED): string {
  return style(
    value
      .toString(16)
      .toUpperCase()
      .padStart(width / 4, '0')
  );
}

const LOGIC_NAMES = { and: 'AND', or: 'OR', xor: 'XOR' } as const;

function shiftSymbol(request: ShiftRequest): string {
  const arrows = request.direction === 'left' ? '<<' : '>>';
  if (request.fill === 'rotate') return `rotated ${request.direction} by`;
  if (request.fill === 'carry') return `rotated ${request.direction} through the carry by`;
  return request.fill === 'sign' ? `${arrows} (keeping the sign)` : arrows;
}

/** How far the shift's switched-on rows move the value in all. */
export function shiftCount(request: ShiftRequest): number {
  return request.stages.reduce((count, stage) => count + (stage.on ? stage.distance : 0), 0);
}

/** The operation on one line: `0x7FFF + 0x0001 = 0x8000`. */
export function equationText(
  request: AluRequest,
  result: number,
  style: HexStyle = PREFIXED
): string {
  const { width } = request;
  const hex = (value: number) => hexOf(value, width, style);
  const equals = `= ${hex(result)}`;
  if (request.kind === 'shift') {
    return `${hex(request.value)} ${shiftSymbol(request)} ${shiftCount(request)} ${equals}`;
  }
  const a = hex(request.a);
  const b = hex(request.b);
  switch (request.kind) {
    case 'add':
      return `${a} + ${b}${request.carryIn ? ' + 1' : ''} ${equals}`;
    case 'subtract':
      return `${a} − ${b}${request.carryIn ? '' : ' − 1'} ${equals}`;
    default:
      return `${a} ${LOGIC_NAMES[request.kind]} ${b} ${equals}`;
  }
}

/** What the circuit is, in a few words: `16-bit adder`. */
export function circuitTitle(request: AluRequest): string {
  const { width } = request;
  switch (request.kind) {
    case 'add':
      return `${width}-bit adder`;
    case 'subtract':
      return `${width}-bit adder, subtracting`;
    case 'shift':
      return `${width}-bit shifter`;
    default:
      return `${width} ${LOGIC_NAMES[request.kind]} gates`;
  }
}

/** One sentence on how the circuit does the operation. */
export function circuitLesson(request: AluRequest): string {
  switch (request.kind) {
    case 'add':
      return 'One full adder per bit. Each adds its two bits and the carry from the bit to its right, and hands its own carry to the left: the carry ripples through.';
    case 'subtract':
      return request.carryIn
        ? 'The same adder subtracts: every bit of B is inverted on its way in and the carry in adds 1, which makes A + (−B) in two’s complement.'
        : 'The same adder subtracts: every bit of B is inverted on its way in, which makes A + (−B) − 1 in two’s complement. The carry in would add the 1 back, and here it is 0: that is the borrow, taken off.';
    case 'shift':
      return request.stages.length > 0 && request.stages.every((stage) => stage.distance === 1)
        ? 'Each row is a line of switches that moves every bit one place. The bit that falls off the end goes to the carry.'
        : 'Each row is a line of switches that moves every bit 1, 2, 4… places when its bit of the count is 1, so any count takes the same few rows.';
    default:
      return 'One gate per bit: each works on a bit of A and the same bit of B, and no bit affects another.';
  }
}

/** Why the CPU's last instruction has no circuit to show, when it has none. */
export function unavailableText(link: AluLink | null): string | null {
  return link && !hasCircuit(link)
    ? `${link.unavailable} The circuit on show is one to try by hand.`
    : null;
}

/**
 * The sections of the logic topic's sidebar. A phone shows the sidebar as a view of its own, so
 * there the switches of the gate picked stay under its truth table, and it has no section.
 */
export function logicSections(phone: boolean, followsCpu: boolean): TopicSectionInfo[] {
  return [
    { id: 'circuit', label: 'Circuit' },
    ...(phone ? [] : [{ id: 'gate', label: 'Gate picked' }]),
    {
      id: 'flags',
      label: followsCpu ? 'Where each flag comes from' : 'What the circuit can also tell'
    }
  ];
}
