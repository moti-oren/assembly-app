import type { AluTrace, ExecutionRecord } from '@/core/mos6502/executionContext';
import { FLAG_NAMES, type CpuState, type FlagName } from '@/core/mos6502/state';
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
        // Said inside brackets after the destination: no brackets of its own.
        note: mnemonic.startsWith('ro') ? `the old C, ${alu.carryIn ? 1 : 0}, goes in` : null
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

/** Instructions that copy a byte into a register and set N and Z from it, without the ALU. */
const LOADED: Partial<Record<string, 'a' | 'x' | 'y'>> = {
  lda: 'a',
  ldx: 'x',
  ldy: 'y',
  tax: 'x',
  tay: 'y',
  txa: 'a',
  tya: 'a',
  tsx: 'x',
  pla: 'a'
};

/** N and Z of a load or a transfer, read from the byte it put in the register. */
function loadedReason(flag: FlagName, register: 'a' | 'x' | 'y', value: number): string | null {
  const byte = `${byteHex(value)}, the byte now in ${register.toUpperCase()},`;
  if (flag === 'N') return `bit 7 of ${byte} is ${value >> 7}`;
  if (flag === 'Z') return `${byte} is ${value === 0 ? '' : 'not '}zero`;
  return null;
}

/** The binary sum or difference, which the NMOS 6502 takes some flags from in decimal mode. */
function binaryOf(alu: AluTrace): string {
  const b = alu.operation === 'subtract' ? alu.b ^ 0xff : alu.b;
  return byteHex((alu.a + b + Number(alu.carryIn)) & 0xff);
}

/** N, V and Z of ADC and SBC in decimal mode, which do not come from the digits in A. */
function decimalReason(alu: AluTrace, flag: 'N' | 'V' | 'Z'): string {
  const binary = binaryOf(alu);
  if (alu.operation === 'subtract')
    return `in decimal mode SBC takes N, V and Z from the binary difference ${binary}, not from the digits`;
  if (flag === 'Z') return `in decimal mode the NMOS 6502 takes Z from the binary sum ${binary}`;
  return `in decimal mode the NMOS 6502 takes ${flag} from the sum before its high digit is adjusted`;
}

function carryReason(alu: AluTrace): string | null {
  const { result } = alu;
  switch (alu.operation) {
    case 'compare':
      return `${byteHex(alu.a)} ${result.carry ? '≥' : '<'} ${byteHex(alu.b)} (unsigned)`;
    case 'subtract':
      return result.carry ? 'no borrow was needed' : 'a borrow was needed';
    case 'shift':
      return `the bit shifted out was ${Number(result.carry)}`;
    case 'add':
      if (alu.decimal)
        return result.carry ? 'the decimal sum passed 99' : 'the decimal sum fit in two digits';
      return result.carry ? 'the sum carried out of bit 7' : 'the sum fit in 8 bits';
    default:
      return null;
  }
}

function overflowReason(alu: AluTrace): string | null {
  if (alu.operation === 'bit') return `bit 6 of the byte is ${Number(alu.result.overflow)}`;
  if (alu.operation !== 'add' && alu.operation !== 'subtract') return null;
  if (alu.decimal) return decimalReason(alu, 'V');
  return alu.result.overflow
    ? 'as signed numbers the result does not fit: it overflowed'
    : 'as signed numbers the result fits';
}

function aluReason(alu: AluTrace, flag: FlagName): string | null {
  const { result } = alu;
  const value = byteHex(result.result);
  const decimal = alu.decimal && (alu.operation === 'add' || alu.operation === 'subtract');
  switch (flag) {
    case 'N':
      if (alu.operation === 'bit') return `bit 7 of the byte is ${Number(result.negative)}`;
      if (decimal) return decimalReason(alu, 'N');
      return `bit 7 of ${value} is ${Number(result.negative)}`;
    case 'Z':
      if (alu.operation === 'bit')
        return `A AND the byte is ${value}${result.zero ? ': zero' : ''}`;
      if (decimal) return decimalReason(alu, 'Z');
      return result.zero ? `the result ${value} is zero` : `the result ${value} is not zero`;
    case 'C':
      return carryReason(alu);
    case 'V':
      return overflowReason(alu);
    default:
      return null;
  }
}

/**
 * Why the last instruction left `flag` as it is, or null when it did not set it. `after` is the
 * CPU right after it, which holds the byte a load or a transfer set N and Z from.
 */
export function flagReason(
  record: ExecutionRecord,
  flag: FlagName,
  after: CpuState
): string | null {
  const { mnemonic } = record.instruction;
  const direct = SET_DIRECTLY[mnemonic];
  if (direct) return direct.flags.includes(flag) ? direct.text : null;
  const loaded = LOADED[mnemonic];
  if (loaded) return loadedReason(flag, loaded, after.registers[loaded]);
  return record.alu && aluReason(record.alu, flag);
}

/** The equation on one line: `$19 + $01 + 1 (C) = $1B`, `$20 − $01 − 1 (borrow) = $1E`. */
export function equationText(equation: AluEquation): string {
  const { left, operator, right, carry, result } = equation;
  const operand = right ? ` ${operator} ${right}` : ` ${operator}`;
  const extra = carry === '1' ? (operator === '−' ? ' − 1 (borrow)' : ' + 1 (C)') : '';
  return `${left}${operand}${extra} = ${result}`;
}
