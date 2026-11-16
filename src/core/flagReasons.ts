import type { AluTrace, ExecutionRecord } from './execute';
import type { FlagName } from './flags';
import { getSpec, type Mnemonic } from './instructions';
import { formatBinary, formatHex, mask, signBit, toSigned, type Size } from './numbers';

/** Why one flag holds the value it does after an instruction. */
export interface FlagReason {
  /** The value the instruction gave the flag, or null when it left the flag as it was. */
  value: boolean | null;
  text: string;
}

const set = (value: boolean, text: string): FlagReason => ({ value, text });
const kept = (text: string): FlagReason => ({ value: null, text });

const hex = (value: number, size: Size): string => `${formatHex(value, size)}h`;
/** Negative numbers with a real minus sign, the one the operators in the text use. */
const decimal = (value: number): string => (value < 0 ? `−${-value}` : String(value));
/** A signed number that can sit after an operator: `5 − (−3)`. */
const signed = (value: number): string => (value < 0 ? `(${decimal(value)})` : String(value));

const FLAG_CONTROL: Partial<
  Record<Mnemonic, { flag: FlagName; value: boolean | null; text: string }>
> = {
  clc: { flag: 'CF', value: false, text: 'CLC clears CF.' },
  stc: { flag: 'CF', value: true, text: 'STC sets CF.' },
  cmc: { flag: 'CF', value: null, text: 'CMC flips CF.' },
  cld: { flag: 'DF', value: false, text: 'CLD clears DF: string instructions count up.' },
  std: { flag: 'DF', value: true, text: 'STD sets DF: string instructions count down.' },
  cli: { flag: 'IF', value: false, text: 'CLI clears IF: maskable interrupts are ignored.' },
  sti: { flag: 'IF', value: true, text: 'STI sets IF: maskable interrupts are allowed.' }
};

/** ZF, SF and PF depend only on the result, whatever operation produced it. */
function resultFlag(flag: 'ZF' | 'SF' | 'PF', result: number, size: Size): FlagReason {
  const shown = hex(result, size);
  switch (flag) {
    case 'ZF':
      return result === 0
        ? set(true, `The result ${shown} is zero.`)
        : set(false, `The result ${shown} is not zero.`);
    case 'SF': {
      const top = size - 1;
      return (result & signBit(size)) !== 0
        ? set(
            true,
            `Bit ${top} of the result ${shown} is 1: as a signed number it is ${decimal(toSigned(result, size))}.`
          )
        : set(false, `Bit ${top} of the result ${shown} is 0: not negative.`);
    }
    case 'PF': {
      const low = result & 0xff;
      const ones = low.toString(2).replace(/0/g, '').length;
      const even = ones % 2 === 0;
      const byte = size === 16 ? 'Only the low byte counts: ' : 'The result ';
      return set(
        even,
        `${byte}${formatBinary(low, 8)} has ${ones} one bit${ones === 1 ? '' : 's'}, an ${even ? 'even' : 'odd'} number.`
      );
    }
  }
}

function arithmeticFlag(
  alu: Extract<AluTrace, { kind: 'add' | 'subtract' }>,
  flag: FlagName,
  name: string
): FlagReason {
  const { size, a, b, carryIn, result } = alu;
  const adding = alu.kind === 'add';
  const operator = adding ? '+' : '−';
  const carry = carryIn ? ` ${operator} 1 (CF)` : '';
  const sum = `${hex(a, size)} ${operator} ${hex(b, size)}${carry}`;

  switch (flag) {
    case 'CF': {
      if (!alu.updatesCarry) return kept(`${name} never changes CF.`);
      if (adding) {
        const raw = a + b + carryIn;
        return raw > mask(size)
          ? set(
              true,
              `${sum} = ${raw.toString(16).toUpperCase()}h needs more than ${size} bits: the carry out of bit ${size - 1} goes into CF.`
            )
          : set(
              false,
              `${sum} = ${hex(result, size)} fits in ${size} bits, so nothing is carried out.`
            );
      }
      return a - b - carryIn < 0
        ? set(true, `${sum} needs a borrow: as unsigned numbers ${a} is less than ${b + carryIn}.`)
        : set(
            false,
            `${sum} needs no borrow: as unsigned numbers ${a} is at least ${b + carryIn}.`
          );
    }
    case 'OF': {
      const signedA = toSigned(a, size);
      const signedB = toSigned(b, size);
      const exact = adding ? signedA + signedB + carryIn : signedA - signedB - carryIn;
      const lowest = -signBit(size);
      const highest = signBit(size) - 1;
      const range = `${decimal(lowest)}…${highest}`;
      const working = `As signed numbers ${signed(signedA)} ${operator} ${signed(signedB)}${carry} = ${signed(exact)}`;
      return exact < lowest || exact > highest
        ? set(
            true,
            `${working}, outside ${range}: the result ${hex(result, size)} reads as ${decimal(toSigned(result, size))}.`
          )
        : set(false, `${working}, which fits in ${range}.`);
    }
    case 'AF': {
      const lowA = a & 0xf;
      const lowB = b & 0xf;
      const nibbles = `Low digits: ${lowA.toString(16).toUpperCase()}h ${operator} ${lowB.toString(16).toUpperCase()}h${carry}`;
      if (adding) {
        const raw = lowA + lowB + carryIn;
        const shown = `${nibbles} = ${raw.toString(16).toUpperCase()}h`;
        return raw > 0xf
          ? set(true, `${shown}, a carry out of bit 3.`)
          : set(false, `${shown}, no carry out of bit 3.`);
      }
      return lowA - lowB - carryIn < 0
        ? set(true, `${nibbles} needs a borrow from bit 4.`)
        : set(false, `${nibbles} needs no borrow from bit 4.`);
    }
    case 'ZF':
    case 'SF':
    case 'PF':
      return resultFlag(flag, result, size);
    default:
      return kept(`${name} does not change ${flag}.`);
  }
}

function shiftFlag(
  alu: Extract<AluTrace, { kind: 'shift' }>,
  flag: FlagName,
  mnemonic: Mnemonic,
  name: string
): FlagReason {
  const { size, original, count, result, carry } = alu;
  const top = signBit(size);
  const bit = (value: number, position: number): number => ((value & position) !== 0 ? 1 : 0);
  const left = mnemonic === 'shl' || mnemonic === 'rol' || mnemonic === 'rcl';
  const rotate = mnemonic !== 'shl' && mnemonic !== 'shr' && mnemonic !== 'sar';

  switch (flag) {
    case 'CF':
      return set(
        carry,
        `CF takes the last bit pushed out of the ${left ? 'top' : 'bottom'} of ${hex(original, size)}: ${carry ? 1 : 0}.`
      );
    case 'OF': {
      if (count !== 1) {
        return kept('OF is only defined for a count of 1; here it keeps its old value.');
      }
      if (left) {
        const was = bit(original, top);
        const now = bit(result, top);
        return was !== now
          ? set(true, `The top bit went from ${was} to ${now}: the sign changed.`)
          : set(false, `The top bit stayed ${now}: the sign did not change.`);
      }
      if (mnemonic === 'shr') {
        const was = bit(original, top);
        return set(was === 1, `SHR by 1 copies the original top bit (${was}) into OF.`);
      }
      if (mnemonic === 'sar') {
        return set(false, 'SAR by 1 always clears OF: it keeps the sign bit.');
      }
      const first = bit(result, top);
      const second = bit(result, top >> 1);
      return set(
        first !== second,
        `OF is the XOR of the two top bits of the result (${first} and ${second}).`
      );
    }
    case 'AF':
      return kept(
        rotate
          ? `${name} does not change AF.`
          : `${name} leaves AF undefined on a real 8086; here it keeps its old value.`
      );
    case 'ZF':
    case 'SF':
    case 'PF':
      return rotate ? kept('Rotates only change CF and OF.') : resultFlag(flag, result, size);
    default:
      return kept(`${name} does not change ${flag}.`);
  }
}

function multiplyFlag(
  alu: Extract<AluTrace, { kind: 'multiply' }>,
  flag: FlagName,
  name: string
): FlagReason {
  if (flag !== 'CF' && flag !== 'OF') {
    return kept(
      flag === 'TF' || flag === 'IF' || flag === 'DF'
        ? `${name} does not change ${flag}.`
        : `${name} leaves ${flag} undefined on a real 8086; here it keeps its old value.`
    );
  }
  const low = alu.size === 8 ? 'AL' : 'AX';
  const high = alu.size === 8 ? 'AH' : 'DX';
  if (alu.signed) {
    return alu.overflow
      ? set(
          true,
          `The product ${decimal(alu.product)} does not fit in ${low} as a signed number, so ${high} holds part of it.`
        )
      : set(
          false,
          `The product ${decimal(alu.product)} fits in ${low} as a signed number: ${high} is only its sign.`
        );
  }
  const product = `${alu.product.toString(16).toUpperCase()}h`;
  return alu.overflow
    ? set(true, `The product ${product} does not fit in ${low}: ${high} is not zero.`)
    : set(false, `The product ${product} fits in ${low}: ${high} is zero.`);
}

/**
 * Explains one flag after `record` ran, in terms of the numbers the instruction worked on.
 * Depends only on the record, so it stays true while the record is the last one in history.
 */
export function explainFlag(record: ExecutionRecord, flag: FlagName): FlagReason {
  const { mnemonic } = record.instruction;
  const name = mnemonic.toUpperCase();

  const control = FLAG_CONTROL[mnemonic];
  if (control) {
    return control.flag === flag
      ? set(control.value ?? (record.before.flags & 1) === 0, control.text)
      : kept(`${name} only changes ${control.flag}.`);
  }

  const { alu } = record;
  if (!alu) {
    if (mnemonic === 'div' || mnemonic === 'idiv') {
      return kept(
        `${name} leaves the flags undefined on a real 8086; here they keep their old values.`
      );
    }
    if (getSpec(mnemonic).category === 'shift') {
      return kept('A count of 0 changes nothing, the flags included.');
    }
    return kept(`${name} does not change the flags.`);
  }

  switch (alu.kind) {
    case 'add':
    case 'subtract':
      return arithmeticFlag(alu, flag, name);
    case 'logic':
      if (flag === 'CF' || flag === 'OF') return set(false, `${name} always clears ${flag}.`);
      if (flag === 'AF') {
        return set(false, `${name} leaves AF undefined on a real 8086; here it is cleared.`);
      }
      if (flag === 'ZF' || flag === 'SF' || flag === 'PF') {
        return resultFlag(flag, alu.result, alu.size);
      }
      return kept(`${name} does not change ${flag}.`);
    case 'shift':
      return shiftFlag(alu, flag, mnemonic, name);
    case 'multiply':
      return multiplyFlag(alu, flag, name);
  }
}
