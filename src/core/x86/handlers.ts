import type { FlagName } from './flags';
import type { Mnemonic } from './instructions';
import { truncate } from '../shared/numbers';
import type { Operand } from './operands';
import { readRegister } from './state';
import { readPort, writePort } from '../shared/state';
import { OVERFLOW_INTERRUPT, type ExecutionContext, type Handler } from './executionContext';
import { divide, multiply, signedDivide, signedMultiply } from './multiplyDivide';
import { shift } from './shift';
import { stringStep } from './stringInstructions';

const binary =
  (operation: (ctx: ExecutionContext, dst: number, src: number) => number, store = true): Handler =>
  (ctx, [dst, src]) => {
    const result = operation(ctx, ctx.read(dst), ctx.read(src));
    if (store) {
      ctx.write(dst, result);
    }
  };

const unary =
  (operation: (ctx: ExecutionContext, value: number) => number): Handler =>
  (ctx, [dst]) => {
    ctx.write(dst, operation(ctx, ctx.read(dst)));
  };

const setFlagTo =
  (flag: FlagName, value: (ctx: ExecutionContext) => boolean): Handler =>
  (ctx) => {
    ctx.setFlag(flag, value(ctx));
  };

/** A conditional jump: jumps when `condition` holds, otherwise falls through to the next line. */
const jumpIf =
  (condition: (ctx: ExecutionContext) => boolean): Handler =>
  (ctx, [target]) => {
    if (condition(ctx)) {
      ctx.jump(target);
    }
  };

/** LOOP variants: CX -= 1 (without touching flags), then jump while CX ≠ 0 and `condition` holds. */
const loopIf =
  (condition: (ctx: ExecutionContext) => boolean): Handler =>
  (ctx, [target]) => {
    const cx = truncate(readRegister(ctx.state, 'cx') - 1, 16);
    ctx.writeRegister('cx', cx);
    if (cx !== 0 && condition(ctx)) {
      ctx.jump(target);
    }
  };

/** The port of IN and OUT: an 8-bit number in the instruction, or whatever DX holds. */
function portNumber(ctx: ExecutionContext, operand: Operand): number {
  return operand.type === 'imm' ? operand.value & 0xff : readRegister(ctx.state, 'dx');
}

const signedLess = (ctx: ExecutionContext) => ctx.flag('SF') !== ctx.flag('OF');

/** What every mnemonic does. */
export const HANDLERS: Record<Mnemonic, Handler> = {
  mov: (ctx, [dst, src]) => ctx.write(dst, ctx.read(src)),
  xchg: (ctx, [a, b]) => {
    const valueA = ctx.read(a);
    const valueB = ctx.read(b);
    ctx.write(a, valueB);
    ctx.write(b, valueA);
  },
  // The 8086 decrements SP before it stores the source, so `push sp` stores the new SP.
  push: (ctx, [src]) => {
    const pushesSp = src.type === 'reg' && src.name === 'sp';
    ctx.push(pushesSp ? truncate(readRegister(ctx.state, 'sp') - 2, 16) : ctx.read(src));
  },
  pop: (ctx, [dst]) => ctx.write(dst, ctx.pop()),

  add: binary((ctx, a, b) => ctx.add(a, b, 0)),
  adc: binary((ctx, a, b) => ctx.add(a, b, ctx.flag('CF') ? 1 : 0)),
  sub: binary((ctx, a, b) => ctx.subtract(a, b, 0)),
  sbb: binary((ctx, a, b) => ctx.subtract(a, b, ctx.flag('CF') ? 1 : 0)),
  cmp: binary((ctx, a, b) => ctx.subtract(a, b, 0), false),
  inc: unary((ctx, value) => ctx.add(value, 1, 0, false)),
  dec: unary((ctx, value) => ctx.subtract(value, 1, 0, false)),
  neg: unary((ctx, value) => ctx.subtract(0, value, 0)),

  mul: multiply,
  imul: signedMultiply,
  div: divide,
  idiv: signedDivide,

  and: binary((ctx, a, b) => ctx.logic(a & b)),
  or: binary((ctx, a, b) => ctx.logic(a | b)),
  xor: binary((ctx, a, b) => ctx.logic(a ^ b)),
  test: binary((ctx, a, b) => ctx.logic(a & b), false),
  not: unary((ctx, value) => truncate(~value, ctx.size)),

  shl: shift('shl'),
  shr: shift('shr'),
  sar: shift('sar'),
  rol: shift('rol'),
  ror: shift('ror'),
  rcl: shift('rcl'),
  rcr: shift('rcr'),

  movsb: stringStep('movs'),
  movsw: stringStep('movs'),
  stosb: stringStep('stos'),
  stosw: stringStep('stos'),
  lodsb: stringStep('lods'),
  lodsw: stringStep('lods'),
  scasb: stringStep('scas'),
  scasw: stringStep('scas'),
  cmpsb: stringStep('cmps'),
  cmpsw: stringStep('cmps'),

  // A word uses two neighbouring ports, low byte first, like a word in memory.
  in: (ctx, [dst, source]) => {
    const port = portNumber(ctx, source);
    const low = readPort(ctx.state, port);
    ctx.write(dst, ctx.size === 8 ? low : low | (readPort(ctx.state, port + 1) << 8));
  },
  out: (ctx, [target, src]) => {
    const port = portNumber(ctx, target);
    const value = ctx.read(src);
    ctx.portWrites.push(writePort(ctx.state, port, value));
    if (ctx.size === 16) ctx.portWrites.push(writePort(ctx.state, port + 1, value >> 8));
  },

  jmp: jumpIf(() => true),
  je: jumpIf((ctx) => ctx.flag('ZF')),
  jz: jumpIf((ctx) => ctx.flag('ZF')),
  jne: jumpIf((ctx) => !ctx.flag('ZF')),
  jnz: jumpIf((ctx) => !ctx.flag('ZF')),
  ja: jumpIf((ctx) => !ctx.flag('CF') && !ctx.flag('ZF')),
  jae: jumpIf((ctx) => !ctx.flag('CF')),
  jb: jumpIf((ctx) => ctx.flag('CF')),
  jbe: jumpIf((ctx) => ctx.flag('CF') || ctx.flag('ZF')),
  jg: jumpIf((ctx) => !ctx.flag('ZF') && !signedLess(ctx)),
  jge: jumpIf((ctx) => !signedLess(ctx)),
  jl: jumpIf(signedLess),
  jle: jumpIf((ctx) => ctx.flag('ZF') || signedLess(ctx)),
  jc: jumpIf((ctx) => ctx.flag('CF')),
  jnc: jumpIf((ctx) => !ctx.flag('CF')),
  js: jumpIf((ctx) => ctx.flag('SF')),
  jns: jumpIf((ctx) => !ctx.flag('SF')),
  jo: jumpIf((ctx) => ctx.flag('OF')),
  jno: jumpIf((ctx) => !ctx.flag('OF')),
  jp: jumpIf((ctx) => ctx.flag('PF')),
  jnp: jumpIf((ctx) => !ctx.flag('PF')),
  jcxz: jumpIf((ctx) => readRegister(ctx.state, 'cx') === 0),
  loop: loopIf(() => true),
  loope: loopIf((ctx) => ctx.flag('ZF')),
  loopne: loopIf((ctx) => !ctx.flag('ZF')),
  call: (ctx, [target]) => {
    // IP already points at the line after the CALL, so that is the return address.
    ctx.push(readRegister(ctx.state, 'ip'));
    ctx.jump(target);
  },
  ret: (ctx) => ctx.writeRegister('ip', ctx.pop()),

  int: (ctx, [type]) => ctx.interrupt(ctx.read(type) & 0xff),
  into: (ctx) => {
    if (ctx.flag('OF')) ctx.interrupt(OVERFLOW_INTERRUPT);
  },
  iret: (ctx) => {
    ctx.writeRegister('ip', ctx.pop());
    ctx.writeRegister('cs', ctx.pop());
    ctx.restoreFlags(ctx.pop());
  },

  pushf: (ctx) => ctx.push(ctx.state.flags),
  popf: (ctx) => ctx.restoreFlags(ctx.pop()),
  clc: setFlagTo('CF', () => false),
  stc: setFlagTo('CF', () => true),
  cmc: setFlagTo('CF', (ctx) => !ctx.flag('CF')),
  cld: setFlagTo('DF', () => false),
  std: setFlagTo('DF', () => true),
  cli: setFlagTo('IF', () => false),
  sti: setFlagTo('IF', () => true),
  nop: () => {}
};
