import type { ExecutionRecord } from './execute';
import type { AluTrace } from './executionContext';
import { FLAG_REASON_TEXTS, type FlagReasonKey } from './flagReasonTexts';
import { isFlagSet, type FlagName } from './flags';
import { getSpec, isStringCompare, type Mnemonic } from './instructions';
import { formatBinary, formatHex, mask, signBit, toSigned, type Size } from '../shared/numbers';
import { fillText, type TextParams } from '../shared/text';

/** Why one flag holds the value it does after an instruction. */
export interface FlagReason {
  /** The value the instruction gave the flag, or null when it left the flag as it was. */
  value: boolean | null;
  /** Which sentence, and what goes in its holes: another language words it by these. */
  key: FlagReasonKey;
  params: TextParams;
  /** The sentence in English. */
  text: string;
}

function reason(value: boolean | null, key: FlagReasonKey, params: TextParams = {}): FlagReason {
  return { value, key, params, text: fillText(FLAG_REASON_TEXTS[key], params) };
}

const set = (value: boolean, key: FlagReasonKey, params?: TextParams) => reason(value, key, params);
const kept = (key: FlagReasonKey, params?: TextParams) => reason(null, key, params);

const hex = (value: number, size: Size): string => `${formatHex(value, size)}h`;
/** Negative numbers with a real minus sign, the one the operators in the text use. */
const decimal = (value: number): string => (value < 0 ? `−${-value}` : String(value));
/** A signed number that can sit after an operator: `5 − (−3)`. */
const signed = (value: number): string => (value < 0 ? `(${decimal(value)})` : String(value));
const upperHex = (value: number): string => value.toString(16).toUpperCase();

const FLAG_CONTROL: Partial<
  Record<Mnemonic, { flag: FlagName; value: boolean | null; key: FlagReasonKey }>
> = {
  clc: { flag: 'CF', value: false, key: 'clc' },
  stc: { flag: 'CF', value: true, key: 'stc' },
  cmc: { flag: 'CF', value: null, key: 'cmc' },
  cld: { flag: 'DF', value: false, key: 'cld' },
  std: { flag: 'DF', value: true, key: 'std' },
  cli: { flag: 'IF', value: false, key: 'cli' },
  sti: { flag: 'IF', value: true, key: 'sti' }
};

/** ZF, SF and PF depend only on the result, whatever operation produced it. */
function resultFlag(flag: 'ZF' | 'SF' | 'PF', result: number, size: Size): FlagReason {
  const shown = hex(result, size);
  switch (flag) {
    case 'ZF':
      return result === 0
        ? set(true, 'zero', { result: shown })
        : set(false, 'notZero', { result: shown });
    case 'SF': {
      const top = size - 1;
      return (result & signBit(size)) !== 0
        ? set(true, 'negative', { top, result: shown, signed: decimal(toSigned(result, size)) })
        : set(false, 'notNegative', { top, result: shown });
    }
    case 'PF': {
      const low = result & 0xff;
      const ones = low.toString(2).replace(/0/g, '').length;
      const even = ones % 2 === 0;
      const key =
        size === 16
          ? even
            ? 'parityLowByteEven'
            : 'parityLowByteOdd'
          : even
            ? 'parityResultEven'
            : 'parityResultOdd';
      return set(even, key, { byte: formatBinary(low, 8), ones });
    }
  }
}

type ArithmeticTrace = Extract<AluTrace, { kind: 'add' | 'subtract' }>;

/** The operation written out as a sum, for the reasons to quote. */
function sumText({ kind, size, a, b, carryIn }: ArithmeticTrace): {
  operator: string;
  carry: string;
  sum: string;
} {
  const operator = kind === 'add' ? '+' : '−';
  const carry = carryIn ? ` ${operator} 1 (CF)` : '';
  return { operator, carry, sum: `${hex(a, size)} ${operator} ${hex(b, size)}${carry}` };
}

function carryReason(alu: ArithmeticTrace, name: string): FlagReason {
  const { size, a, b, carryIn, result } = alu;
  const { sum } = sumText(alu);
  if (!alu.updatesCarry) return kept('neverCarry', { name });
  if (alu.kind === 'add') {
    const raw = a + b + carryIn;
    return raw > mask(size)
      ? set(true, 'carryOut', { sum, raw: upperHex(raw), size, top: size - 1 })
      : set(false, 'noCarryOut', { sum, result: hex(result, size), size });
  }
  return a - b - carryIn < 0
    ? set(true, 'borrow', { sum, a, b: b + carryIn })
    : set(false, 'noBorrow', { sum, a, b: b + carryIn });
}

function overflowReason(alu: ArithmeticTrace): FlagReason {
  const { size, a, b, carryIn, result } = alu;
  const { operator, carry } = sumText(alu);
  const signedA = toSigned(a, size);
  const signedB = toSigned(b, size);
  const exact = alu.kind === 'add' ? signedA + signedB + carryIn : signedA - signedB - carryIn;
  const lowest = -signBit(size);
  const highest = signBit(size) - 1;
  const params = {
    a: signed(signedA),
    operator,
    b: signed(signedB),
    carry,
    exact: signed(exact),
    range: `${decimal(lowest)}…${highest}`
  };
  return exact < lowest || exact > highest
    ? set(true, 'overflow', {
        ...params,
        result: hex(result, size),
        signed: decimal(toSigned(result, size))
      })
    : set(false, 'noOverflow', params);
}

function auxiliaryCarryReason(alu: ArithmeticTrace): FlagReason {
  const { a, b, carryIn } = alu;
  const { operator, carry } = sumText(alu);
  const lowA = a & 0xf;
  const lowB = b & 0xf;
  const params = { a: upperHex(lowA), operator, b: upperHex(lowB), carry };
  if (alu.kind === 'add') {
    const raw = upperHex(lowA + lowB + carryIn);
    return lowA + lowB + carryIn > 0xf
      ? set(true, 'auxCarry', { ...params, raw })
      : set(false, 'noAuxCarry', { ...params, raw });
  }
  return lowA - lowB - carryIn < 0
    ? set(true, 'auxBorrow', params)
    : set(false, 'noAuxBorrow', params);
}

function arithmeticFlag(alu: ArithmeticTrace, flag: FlagName, name: string): FlagReason {
  switch (flag) {
    case 'CF':
      return carryReason(alu, name);
    case 'OF':
      return overflowReason(alu);
    case 'AF':
      return auxiliaryCarryReason(alu);
    case 'ZF':
    case 'SF':
    case 'PF':
      return resultFlag(flag, alu.result, alu.size);
    default:
      return kept('unchanged', { name, flag });
  }
}

type ShiftTrace = Extract<AluTrace, { kind: 'shift' }>;

const bit = (value: number, position: number): number => ((value & position) !== 0 ? 1 : 0);

function shiftOverflowReason(alu: ShiftTrace, mnemonic: Mnemonic, left: boolean): FlagReason {
  const { size, original, count, result } = alu;
  const top = signBit(size);
  if (count !== 1) return kept('shiftOverflowCount');
  if (left) {
    const was = bit(original, top);
    const now = bit(result, top);
    return was !== now ? set(true, 'signChanged', { was, now }) : set(false, 'signKept', { now });
  }
  if (mnemonic === 'shr') {
    const was = bit(original, top);
    return set(was === 1, 'shrOverflow', { was });
  }
  if (mnemonic === 'sar') return set(false, 'sarOverflow');
  const first = bit(result, top);
  const second = bit(result, top >> 1);
  return set(first !== second, 'rotateOverflow', { first, second });
}

function shiftFlag(alu: ShiftTrace, flag: FlagName, mnemonic: Mnemonic, name: string): FlagReason {
  const { size, original, result, carry } = alu;
  const left = mnemonic === 'shl' || mnemonic === 'rol' || mnemonic === 'rcl';
  const rotate = mnemonic !== 'shl' && mnemonic !== 'shr' && mnemonic !== 'sar';

  switch (flag) {
    case 'CF':
      return set(carry, left ? 'shiftCarryTop' : 'shiftCarryBottom', {
        original: hex(original, size),
        carry: carry ? 1 : 0
      });
    case 'OF':
      return shiftOverflowReason(alu, mnemonic, left);
    case 'AF':
      return rotate ? kept('unchanged', { name, flag }) : kept('undefinedKept', { name, flag });
    case 'ZF':
    case 'SF':
    case 'PF':
      return rotate ? kept('rotateOnly') : resultFlag(flag, result, size);
    default:
      return kept('unchanged', { name, flag });
  }
}

function multiplyFlag(
  alu: Extract<AluTrace, { kind: 'multiply' }>,
  flag: FlagName,
  name: string
): FlagReason {
  if (flag !== 'CF' && flag !== 'OF') {
    return flag === 'TF' || flag === 'IF' || flag === 'DF'
      ? kept('unchanged', { name, flag })
      : kept('undefinedKept', { name, flag });
  }
  const low = alu.size === 8 ? 'AL' : 'AX';
  const high = alu.size === 8 ? 'AH' : 'DX';
  if (alu.signed) {
    const params = { product: decimal(alu.product), low, high };
    return alu.overflow
      ? set(true, 'productSignedOverflow', params)
      : set(false, 'productSignedFits', params);
  }
  const params = { product: `${upperHex(alu.product)}h`, low, high };
  return alu.overflow ? set(true, 'productOverflow', params) : set(false, 'productFits', params);
}

function logicFlag(
  alu: Extract<AluTrace, { kind: 'logic' }>,
  flag: FlagName,
  name: string
): FlagReason {
  if (flag === 'CF' || flag === 'OF') return set(false, 'alwaysClears', { name, flag });
  if (flag === 'AF') return set(false, 'auxCleared', { name });
  if (flag === 'ZF' || flag === 'SF' || flag === 'PF') {
    return resultFlag(flag, alu.result, alu.size);
  }
  return kept('unchanged', { name, flag });
}

/** Why the flags kept their values when the instruction computed nothing in the ALU. */
function withoutAlu(mnemonic: Mnemonic, name: string): FlagReason {
  if (mnemonic === 'div' || mnemonic === 'idiv') return kept('divideUndefined', { name });
  if (isStringCompare(mnemonic)) return kept('repeatZero');
  if (getSpec(mnemonic).category === 'shift') return kept('countZero');
  return kept('noFlagsChange', { name });
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
      ? set(control.value ?? (record.before.flags & 1) === 0, control.key)
      : kept('onlyChanges', { name, flag: control.flag });
  }

  const { alu } = record;
  if (record.interrupt !== null && (flag === 'IF' || flag === 'TF')) {
    return set(false, 'interruptClears', { flag });
  }
  if (!alu) return withoutAlu(mnemonic, name);

  switch (alu.kind) {
    case 'add':
    case 'subtract':
      return arithmeticFlag(alu, flag, name);
    case 'logic':
      return logicFlag(alu, flag, name);
    case 'shift':
      return shiftFlag(alu, flag, mnemonic, name);
    case 'multiply':
      return multiplyFlag(alu, flag, name);
    case 'restore':
      return set(isFlagSet(alu.flags, flag), 'restored', { name });
  }
}
