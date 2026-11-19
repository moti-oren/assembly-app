import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { FLAG_NAMES, type FlagName } from '@/core/mos6502/state';
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

function destinationOf(record: ExecutionRecord): string {
  const { mnemonic, operands } = record.instruction;
  if (['cmp', 'cpx', 'cpy', 'bit'].includes(mnemonic)) return 'only the flags are kept';
  if (['inx', 'dex'].includes(mnemonic)) return 'into X';
  if (['iny', 'dey'].includes(mnemonic)) return 'into Y';
  const inMemory = record.access?.write && operands[0] && operands[0].type !== 'acc';
  return inMemory ? `back to ${wordHex(record.access!.address)}` : 'into A';
}

export function aluEquation(record: ExecutionRecord): AluEquation | null {
  const { alu, instruction } = record;
  if (!alu) return null;
  const { mnemonic } = instruction;
  const result = byteHex(alu.result.result);
  const destination = destinationOf(record);
  const decimal = alu.decimal ? 'decimal (BCD) digits' : null;
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
        note: decimal ?? 'the carry in is 1 − C, the borrow'
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
        note: 'N and V come from the byte itself'
      };
    case 'shift':
      return {
        left: byteHex(alu.a),
        operator: SHIFTS[mnemonic],
        right: '',
        carry: null,
        result,
        destination,
        note: mnemonic.startsWith('ro') ? `C goes in (was ${alu.carryIn ? 1 : 0})` : null
      };
    case 'step':
      return {
        left: byteHex(alu.a),
        operator: mnemonic.startsWith('de') ? '−' : '+',
        right: '1',
        carry: null,
        result,
        destination,
        note: 'C is left alone'
      };
  }
}

/** Instructions that set flags without the ALU: which flags, and why. */
const SET_DIRECTLY: Partial<Record<string, { flags: readonly FlagName[]; text: string }>> = {
  clc: { flags: ['C'], text: 'CLC cleared C' },
  sec: { flags: ['C'], text: 'SEC set C' },
  cli: { flags: ['I'], text: 'CLI cleared I: interrupts can come in' },
  sei: { flags: ['I'], text: 'SEI set I: interrupts are held off' },
  cld: { flags: ['D'], text: 'CLD cleared D: binary arithmetic' },
  sed: { flags: ['D'], text: 'SED set D: ADC and SBC work in decimal' },
  clv: { flags: ['V'], text: 'CLV cleared V' },
  brk: { flags: ['I'], text: 'BRK set I, so another interrupt waits' },
  plp: { flags: FLAG_NAMES, text: 'PLP pulled P from the stack' },
  rti: { flags: FLAG_NAMES, text: 'RTI pulled P from the stack' }
};

/** Why the last instruction left `flag` as it is, or null when it did not set it. */
export function flagReason(record: ExecutionRecord, flag: FlagName): string | null {
  const direct = SET_DIRECTLY[record.instruction.mnemonic];
  if (direct) return direct.flags.includes(flag) ? direct.text : null;
  const { alu } = record;
  if (!alu) return null;
  const { result } = alu;
  const value = byteHex(result.result);
  switch (flag) {
    case 'N':
      if (alu.operation === 'bit') return `bit 7 of the byte is ${Number(result.negative)}`;
      if (alu.decimal)
        return `in decimal mode the NMOS 6502 takes N from the sum before its high digit is adjusted`;
      return `bit 7 of ${value} is ${Number(result.negative)}`;
    case 'Z':
      if (alu.operation === 'bit')
        return `A AND the byte is ${value}${result.zero ? ': zero' : ''}`;
      if (alu.decimal && alu.operation === 'add')
        return `in decimal mode the NMOS 6502 takes Z from the binary sum, not from ${value}`;
      return result.zero ? `the result ${value} is zero` : `the result ${value} is not zero`;
    case 'C':
      if (alu.operation === 'compare')
        return result.carry
          ? `${byteHex(alu.a)} ≥ ${byteHex(alu.b)} (unsigned)`
          : `${byteHex(alu.a)} < ${byteHex(alu.b)} (unsigned)`;
      if (alu.operation === 'subtract')
        return result.carry ? 'no borrow was needed' : 'a borrow was needed';
      if (alu.operation === 'shift') return `the bit shifted out was ${Number(result.carry)}`;
      if (alu.operation === 'add')
        return result.carry ? 'the sum carried out of bit 7' : 'the sum fit in 8 bits';
      return null;
    case 'V':
      if (alu.operation === 'bit') return `bit 6 of the byte is ${Number(result.overflow)}`;
      if (alu.operation !== 'add' && alu.operation !== 'subtract') return null;
      if (alu.decimal)
        return 'in decimal mode the NMOS 6502 takes V from the sum before its high digit is adjusted';
      return result.overflow
        ? 'as signed numbers the result does not fit: it overflowed'
        : 'as signed numbers the result fits';
    default:
      return null;
  }
}

/** The equation on one line: `$19 + $01 + 1 (C) = $1B`, `$20 − $01 − 1 (borrow) = $1E`. */
export function equationText(equation: AluEquation): string {
  const { left, operator, right, carry, result } = equation;
  const operand = right ? ` ${operator} ${right}` : ` ${operator}`;
  const extra = carry === '1' ? (operator === '−' ? ' − 1 (borrow)' : ' + 1 (C)') : '';
  return `${left}${operand}${extra} = ${result}`;
}
