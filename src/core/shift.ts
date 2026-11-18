import { mask, signBit, type Size } from './numbers';
import { readRegister } from './state';
import type { Handler } from './executionContext';

type ShiftMnemonic = 'shl' | 'shr' | 'sar' | 'rol' | 'ror' | 'rcl' | 'rcr';

/** One bit of a shift or rotate: the new value, and the bit that went out into CF. */
function shiftOnce(
  mnemonic: ShiftMnemonic,
  value: number,
  carry: boolean,
  size: Size
): { value: number; carry: boolean } {
  const top = signBit(size);
  const all = mask(size);
  const outTop = (value & top) !== 0;
  const outBottom = (value & 1) !== 0;
  switch (mnemonic) {
    case 'shl':
      return { value: (value << 1) & all, carry: outTop };
    case 'shr':
      return { value: value >>> 1, carry: outBottom };
    case 'sar':
      return { value: (value >>> 1) | (value & top), carry: outBottom };
    case 'rol':
      return { value: ((value << 1) | (outTop ? 1 : 0)) & all, carry: outTop };
    case 'ror':
      return { value: (value >>> 1) | (outBottom ? top : 0), carry: outBottom };
    case 'rcl':
      return { value: ((value << 1) | (carry ? 1 : 0)) & all, carry: outTop };
    case 'rcr':
      return { value: (value >>> 1) | (carry ? top : 0), carry: outBottom };
  }
}

/** OF after a shift or rotate by 1. The 8086 defines it only for that count. */
function overflowAfterOne(
  mnemonic: ShiftMnemonic,
  original: number,
  result: number,
  carry: boolean,
  size: Size
): boolean {
  const top = signBit(size);
  const topBit = (result & top) !== 0;
  const nextBit = (result & (top >> 1)) !== 0;
  switch (mnemonic) {
    case 'shl':
    case 'rol':
    case 'rcl':
      return topBit !== carry;
    case 'shr':
      return (original & top) !== 0;
    case 'sar':
      return false;
    case 'ror':
    case 'rcr':
      return topBit !== nextBit;
  }
}

/** SHL, SHR, SAR and the four rotates, by 1 or by CL. */
export const shift =
  (mnemonic: ShiftMnemonic): Handler =>
  (ctx, [dst, countOperand]) => {
    // The 8086 does not mask the count (later CPUs mask it to 5 bits).
    const count = countOperand.type === 'imm' ? countOperand.value : readRegister(ctx.state, 'cl');
    if (count === 0) {
      return;
    }

    const original = ctx.read(dst);
    let value = original;
    let carry = ctx.flag('CF');
    for (let i = 0; i < count; i++) {
      ({ value, carry } = shiftOnce(mnemonic, value, carry, ctx.size));
    }

    ctx.write(dst, value);
    ctx.setFlag('CF', carry);
    ctx.alu = { kind: 'shift', size: ctx.size, original, count, result: value, carry };
    if (count === 1) {
      ctx.setFlag('OF', overflowAfterOne(mnemonic, original, value, carry, ctx.size));
    }
    // Rotates leave SF, ZF and PF alone.
    if (mnemonic === 'shl' || mnemonic === 'shr' || mnemonic === 'sar') {
      ctx.setResultFlags(value);
    }
  };
