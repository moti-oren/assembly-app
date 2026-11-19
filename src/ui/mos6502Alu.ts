import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { FLAG_NAMES, type FlagName } from '@/core/mos6502/state';
import type { Messages } from './messages/en';
import { byteHex, wordHex } from './mos6502Explain';

/** What the ALU computed, written as a sum. */
export interface AluEquation {
  left: string;
  operator: string;
  right: string;
  /** The carry going in, for ADC and SBC. */
  carry: string | null;
  result: string;
  /** Where the result went, or that only the flags were kept. */
  destination: string;
  note: string | null;
}

const LOGIC: Record<string, string> = { and: 'AND', ora: 'OR', eor: 'XOR' };
const SHIFTS: Record<string, string> = { asl: '<< 1', lsr: '>> 1', rol: '<< 1 ⟲', ror: '>> 1 ⟲' };

function destinationOf(m: Messages, record: ExecutionRecord): string {
  const a = m.mos6502Alu;
  const { mnemonic, operands } = record.instruction;
  if (['cmp', 'cpx', 'cpy', 'bit'].includes(mnemonic)) return a.flagsOnly;
  if (['inx', 'dex'].includes(mnemonic)) return a.into('X');
  if (['iny', 'dey'].includes(mnemonic)) return a.into('Y');
  const inMemory = record.access?.write && operands[0] && operands[0].type !== 'acc';
  return inMemory ? a.backTo(wordHex(record.access!.address)) : a.into('A');
}

export function aluEquation(m: Messages, record: ExecutionRecord): AluEquation | null {
  const a = m.mos6502Alu;
  const { alu, instruction } = record;
  if (!alu) return null;
  const { mnemonic } = instruction;
  const result = byteHex(alu.result.result);
  const destination = destinationOf(m, record);
  const decimal = alu.decimal ? a.decimal : null;
  switch (alu.operation) {
    case 'add':
      return {
        left: byteHex(alu.a),
        operator: '+',
        right: byteHex(alu.b),
        carry: alu.carryIn ? '1' : '0',
        result,
        destination,
        note: decimal
      };
    case 'subtract':
      return {
        left: byteHex(alu.a),
        operator: '−',
        right: byteHex(alu.b),
        carry: alu.carryIn ? '0' : '1',
        result,
        destination,
        note: decimal ?? a.borrow
      };
    case 'compare':
      return {
        left: byteHex(alu.a),
        operator: '−',
        right: byteHex(alu.b),
        carry: null,
        result,
        destination,
        note: null
      };
    case 'logic':
      return {
        left: byteHex(alu.a),
        operator: LOGIC[mnemonic],
        right: byteHex(alu.b),
        carry: null,
        result,
        destination,
        note: null
      };
    case 'bit':
      return {
        left: byteHex(alu.a),
        operator: 'AND',
        right: byteHex(alu.b),
        carry: null,
        result,
        destination,
        note: a.bitNote
      };
    case 'shift':
      return {
        left: byteHex(alu.a),
        operator: SHIFTS[mnemonic],
        right: '',
        carry: null,
        result,
        destination,
        note: mnemonic.startsWith('ro') ? a.rotate(alu.carryIn ? 1 : 0) : null
      };
    case 'step':
      return {
        left: byteHex(alu.a),
        operator: mnemonic.startsWith('de') ? '−' : '+',
        right: '1',
        carry: null,
        result,
        destination,
        note: a.carryAlone
      };
  }
}

/** Instructions that set flags without the ALU: which flags, and why. */
type DirectMnemonic = keyof Messages['mos6502Alu']['direct'];

const SET_DIRECTLY: Record<DirectMnemonic, readonly FlagName[]> = {
  clc: ['C'],
  sec: ['C'],
  cli: ['I'],
  sei: ['I'],
  cld: ['D'],
  sed: ['D'],
  clv: ['V'],
  brk: ['I'],
  plp: FLAG_NAMES,
  rti: FLAG_NAMES
};

function isDirect(mnemonic: string): mnemonic is DirectMnemonic {
  return mnemonic in SET_DIRECTLY;
}

/** Why the last instruction left `flag` as it is, or null when it did not set it. */
export function flagReason(m: Messages, record: ExecutionRecord, flag: FlagName): string | null {
  const { mnemonic } = record.instruction;
  if (isDirect(mnemonic)) {
    return SET_DIRECTLY[mnemonic].includes(flag) ? m.mos6502Alu.direct[mnemonic] : null;
  }
  const { alu } = record;
  if (!alu) return null;
  return aluFlagReason(m, alu, flag);
}

/** Why the ALU set `flag` as it did. */
function aluFlagReason(
  m: Messages,
  alu: NonNullable<ExecutionRecord['alu']>,
  flag: FlagName
): string | null {
  const a = m.mos6502Alu;
  const { result } = alu;
  const value = byteHex(result.result);
  switch (flag) {
    case 'N':
      if (alu.operation === 'bit') return a.bit7OfByte(Number(result.negative));
      if (alu.decimal) return a.decimalNV;
      return a.bit7Of(value, Number(result.negative));
    case 'Z':
      if (alu.operation === 'bit') return a.andByte(value, result.zero);
      if (alu.decimal && alu.operation === 'add') return a.decimalZ(value);
      return result.zero ? a.zero(value) : a.notZero(value);
    case 'C':
      if (alu.operation === 'compare')
        return result.carry
          ? a.atLeast(byteHex(alu.a), byteHex(alu.b))
          : a.below(byteHex(alu.a), byteHex(alu.b));
      if (alu.operation === 'subtract') return result.carry ? a.noBorrow : a.borrowed;
      if (alu.operation === 'shift') return a.shiftedOut(Number(result.carry));
      if (alu.operation === 'add') return result.carry ? a.carried : a.fit;
      return null;
    case 'V':
      if (alu.operation === 'bit') return a.bit6(Number(result.overflow));
      if (alu.operation !== 'add' && alu.operation !== 'subtract') return null;
      if (alu.decimal) return a.decimalV;
      return result.overflow ? a.overflowed : a.fits;
    default:
      return null;
  }
}

/** The equation on one line: `$19 + $01 + 1 (C) = $1B`, `$20 − $01 − 1 (borrow) = $1E`. */
export function equationText(m: Messages, equation: AluEquation): string {
  const { left, operator, right, carry, result } = equation;
  const operand = right ? ` ${operator} ${right}` : ` ${operator}`;
  const extra =
    carry === '1' ? (operator === '−' ? ` − 1 ${m.mos6502Alu.borrowMark}` : ' + 1 (C)') : '';
  return `${left}${operand}${extra} = ${result}`;
}
