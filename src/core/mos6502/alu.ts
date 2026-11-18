/**
 * The 6502's arithmetic on 8-bit values. ADC and SBC work in binary, or in packed BCD when D is
 * set; in BCD the NMOS chip's N, V and Z come out of intermediate sums, and those quirks are kept.
 */
export interface AluResult {
  result: number;
  carry: boolean;
  zero: boolean;
  negative: boolean;
  overflow: boolean;
}

/** A byte read as a signed number. */
const signed = (value: number) => (value & 0x80 ? value - 0x100 : value);

function binaryAdd(a: number, b: number, carry: number): AluResult {
  const sum = a + b + carry;
  const result = sum & 0xff;
  return {
    result,
    carry: sum > 0xff,
    zero: result === 0,
    negative: (result & 0x80) !== 0,
    overflow: (~(a ^ b) & (a ^ result) & 0x80) !== 0
  };
}

/**
 * BCD addition as the NMOS 6502 does it (Bruce Clark, "Decimal Mode", appendix A): A and C come
 * from the adjusted digits; N and V from the sum before the high digit is adjusted, taken as
 * signed; Z from the plain binary sum.
 */
function decimalAdd(a: number, b: number, carry: number): AluResult {
  let low = (a & 0x0f) + (b & 0x0f) + carry;
  if (low >= 0x0a) low = ((low + 0x06) & 0x0f) + 0x10;
  const signedSum = signed(a & 0xf0) + signed(b & 0xf0) + low;
  let sum = (a & 0xf0) + (b & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return {
    result: sum & 0xff,
    carry: sum >= 0x100,
    zero: ((a + b + carry) & 0xff) === 0,
    negative: (signedSum & 0x80) !== 0,
    overflow: signedSum < -128 || signedSum > 127
  };
}

/** BCD subtraction on the NMOS 6502: the digits are adjusted, but every flag is binary SBC's. */
function decimalSubtract(a: number, b: number, carry: number): AluResult {
  const flags = binaryAdd(a, b ^ 0xff, carry);
  let low = (a & 0x0f) - (b & 0x0f) + carry - 1;
  if (low < 0) low = ((low - 0x06) & 0x0f) - 0x10;
  let difference = (a & 0xf0) - (b & 0xf0) + low;
  if (difference < 0) difference -= 0x60;
  return { ...flags, result: difference & 0xff };
}

export function add(a: number, b: number, carry: boolean, decimal: boolean): AluResult {
  return decimal ? decimalAdd(a, b, Number(carry)) : binaryAdd(a, b, Number(carry));
}

/** SBC is ADC of the inverted operand, so C = 1 means "no borrow". */
export function subtract(a: number, b: number, carry: boolean, decimal: boolean): AluResult {
  return decimal ? decimalSubtract(a, b, Number(carry)) : binaryAdd(a, b ^ 0xff, Number(carry));
}

/** CMP, CPX and CPY: a subtraction that keeps only C, Z and N. C = 1 when register ≥ operand. */
export function compare(register: number, operand: number): AluResult {
  return { ...binaryAdd(register, operand ^ 0xff, 1), overflow: false };
}

export type ShiftMnemonic = 'asl' | 'lsr' | 'rol' | 'ror';

export function shift(mnemonic: ShiftMnemonic, value: number, carry: boolean): AluResult {
  const into = Number(carry);
  const [result, out] = {
    asl: [(value << 1) & 0xff, value & 0x80],
    lsr: [value >> 1, value & 1],
    rol: [((value << 1) | into) & 0xff, value & 0x80],
    ror: [(value >> 1) | (into << 7), value & 1]
  }[mnemonic];
  return {
    result,
    carry: out !== 0,
    zero: result === 0,
    negative: (result & 0x80) !== 0,
    overflow: false
  };
}
