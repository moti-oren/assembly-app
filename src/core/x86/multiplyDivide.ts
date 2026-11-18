import { DivideError } from '../shared/cpuError';
import { signBit, toSigned, type Size } from '../shared/numbers';
import { readRegister } from './state';
import type { Handler } from './executionContext';

function divideError(reason: string): never {
  throw new DivideError(`Divide error (#DE): ${reason}`);
}

const DIVISOR_ZERO = 'the divisor is 0. Put a non-zero value in it first.';

function quotientTooBig(quotient: number, size: Size): never {
  return size === 8
    ? divideError(
        `the quotient ${quotient} is too big for AL. Divide a smaller value, or use a 16-bit divisor.`
      )
    : divideError(`the quotient ${quotient} is too big for AX. Divide a smaller value in DX:AX.`);
}

/** MUL: AL or AX times the operand, into AX or DX:AX. */
export const multiply: Handler = (ctx, [src]) => {
  const factor = ctx.read(src);
  if (ctx.size === 8) {
    const product = readRegister(ctx.state, 'al') * factor;
    ctx.writeRegister('ax', product);
    ctx.setProductFlags(product, false, product > 0xff);
  } else {
    const product = readRegister(ctx.state, 'ax') * factor;
    ctx.writeRegister('ax', product % 0x10000);
    ctx.writeRegister('dx', Math.floor(product / 0x10000));
    ctx.setProductFlags(product, false, product > 0xffff);
  }
};

/** IMUL: the signed form of MUL. */
export const signedMultiply: Handler = (ctx, [src]) => {
  const factor = toSigned(ctx.read(src), ctx.size);
  if (ctx.size === 8) {
    const product = toSigned(readRegister(ctx.state, 'al'), 8) * factor;
    ctx.writeRegister('ax', product);
    ctx.setProductFlags(product, true, product < -0x80 || product > 0x7f);
  } else {
    const product = toSigned(readRegister(ctx.state, 'ax'), 16) * factor;
    ctx.writeRegister('ax', product);
    ctx.writeRegister('dx', product >> 16);
    ctx.setProductFlags(product, true, product < -0x8000 || product > 0x7fff);
  }
};

/** DIV: AX or DX:AX by the operand; the quotient and remainder share the dividend's register. */
export const divide: Handler = (ctx, [src]) => {
  const divisor = ctx.read(src);
  if (divisor === 0) divideError(DIVISOR_ZERO);
  if (ctx.size === 8) {
    const dividend = readRegister(ctx.state, 'ax');
    const quotient = Math.floor(dividend / divisor);
    if (quotient > 0xff) quotientTooBig(quotient, 8);
    ctx.writeRegister('al', quotient);
    ctx.writeRegister('ah', dividend % divisor);
  } else {
    const dividend = readRegister(ctx.state, 'dx') * 0x10000 + readRegister(ctx.state, 'ax');
    const quotient = Math.floor(dividend / divisor);
    if (quotient > 0xffff) quotientTooBig(quotient, 16);
    ctx.writeRegister('ax', quotient);
    ctx.writeRegister('dx', dividend % divisor);
  }
};

/** IDIV: the signed form of DIV. */
export const signedDivide: Handler = (ctx, [src]) => {
  const divisor = toSigned(ctx.read(src), ctx.size);
  if (divisor === 0) divideError(DIVISOR_ZERO);
  const dividend =
    ctx.size === 8
      ? toSigned(readRegister(ctx.state, 'ax'), 16)
      : (readRegister(ctx.state, 'dx') << 16) | readRegister(ctx.state, 'ax');
  const quotient = Math.trunc(dividend / divisor);
  const remainder = dividend % divisor; // takes the sign of the dividend, like the 8086
  const limit = signBit(ctx.size);
  if (quotient < -limit || quotient > limit - 1) {
    quotientTooBig(quotient, ctx.size);
  }
  if (ctx.size === 8) {
    ctx.writeRegister('al', quotient);
    ctx.writeRegister('ah', remainder);
  } else {
    ctx.writeRegister('ax', quotient);
    ctx.writeRegister('dx', remainder);
  }
};
