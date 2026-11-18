import { mask, signBit } from './numbers';
import { readRegister } from './state';
import type { Handler } from './executionContext';

type ShiftMnemonic = 'shl' | 'shr' | 'sar' | 'rol' | 'ror' | 'rcl' | 'rcr';

/** SHL, SHR, SAR and the four rotates, by 1 or by CL. */
export const shift =
  (mnemonic: ShiftMnemonic): Handler =>
  (ctx, [dst, countOperand]) => {
    // The 8086 does not mask the count (later CPUs mask it to 5 bits).
    const count = countOperand.type === 'imm' ? countOperand.value : readRegister(ctx.state, 'cl');
    if (count === 0) {
      return;
    }

    const top = signBit(ctx.size);
    const all = mask(ctx.size);
    const original = ctx.read(dst);
    let value = original;
    let carry = ctx.flag('CF');

    for (let i = 0; i < count; i++) {
      const outTop = (value & top) !== 0;
      const outBottom = (value & 1) !== 0;
      switch (mnemonic) {
        case 'shl':
          value = (value << 1) & all;
          carry = outTop;
          break;
        case 'shr':
          value = value >>> 1;
          carry = outBottom;
          break;
        case 'sar':
          value = (value >>> 1) | (value & top);
          carry = outBottom;
          break;
        case 'rol':
          value = ((value << 1) | (outTop ? 1 : 0)) & all;
          carry = outTop;
          break;
        case 'ror':
          value = (value >>> 1) | (outBottom ? top : 0);
          carry = outBottom;
          break;
        case 'rcl':
          value = ((value << 1) | (carry ? 1 : 0)) & all;
          carry = outTop;
          break;
        case 'rcr':
          value = (value >>> 1) | (carry ? top : 0);
          carry = outBottom;
          break;
      }
    }

    ctx.write(dst, value);
    ctx.setFlag('CF', carry);
    ctx.alu = { kind: 'shift', size: ctx.size, original, count, result: value, carry };

    // OF is only defined for single-bit shifts and rotates.
    if (count === 1) {
      const topBit = (value & top) !== 0;
      const nextBit = (value & (top >> 1)) !== 0;
      switch (mnemonic) {
        case 'shl':
        case 'rol':
        case 'rcl':
          ctx.setFlag('OF', topBit !== carry);
          break;
        case 'shr':
          ctx.setFlag('OF', (original & top) !== 0);
          break;
        case 'sar':
          ctx.setFlag('OF', false);
          break;
        case 'ror':
        case 'rcr':
          ctx.setFlag('OF', topBit !== nextBit);
          break;
      }
    }

    // Rotates leave SF, ZF and PF alone.
    if (mnemonic === 'shl' || mnemonic === 'shr' || mnemonic === 'sar') {
      ctx.setResultFlags(value);
    }
  };
