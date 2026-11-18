import type { RepeatPrefix } from './instructions';
import { readRegister } from './state';
import type { ExecutionContext, Handler } from './executionContext';

type StringOperation = 'movs' | 'stos' | 'lods' | 'scas' | 'cmps';

/** One element of a string instruction: the source is DS:SI, the destination is ES:DI. */
export const stringStep =
  (operation: StringOperation): Handler =>
  (ctx) => {
    const accumulator = ctx.size === 8 ? 'al' : 'ax';
    const si = readRegister(ctx.state, 'si');
    const di = readRegister(ctx.state, 'di');
    // DF picks the direction: up through memory when clear, down when set.
    const delta = (ctx.flag('DF') ? -1 : 1) * (ctx.size / 8);
    const usesSource = operation === 'movs' || operation === 'lods' || operation === 'cmps';

    switch (operation) {
      case 'movs':
        ctx.writeAt('es', di, ctx.readAt('ds', si));
        break;
      case 'stos':
        ctx.writeAt('es', di, readRegister(ctx.state, accumulator));
        break;
      case 'lods':
        ctx.writeRegister(accumulator, ctx.readAt('ds', si));
        break;
      case 'scas':
        ctx.subtract(readRegister(ctx.state, accumulator), ctx.readAt('es', di), 0);
        break;
      case 'cmps':
        ctx.subtract(ctx.readAt('ds', si), ctx.readAt('es', di), 0);
        break;
    }

    if (usesSource) ctx.writeRegister('si', si + delta);
    if (operation !== 'lods') ctx.writeRegister('di', di + delta);
  };

/**
 * A repeat prefix: runs `step` while CX ≠ 0, counting CX down without touching the flags.
 * CX is tested first, so CX = 0 runs nothing. REPE and REPNE also stop on the compare's ZF.
 */
export function repeat(ctx: ExecutionContext, prefix: RepeatPrefix, step: () => void): void {
  // CX is counted in a local and stored once: the string steps never read it, and under a
  // reactive state every register access is a proxy hit, 65535 times for a full CX.
  const start = readRegister(ctx.state, 'cx');
  let cx = start;
  try {
    while (cx !== 0) {
      step();
      cx--;
      if (prefix === 'repe' && !ctx.flag('ZF')) return;
      if (prefix === 'repne' && ctx.flag('ZF')) return;
    }
  } finally {
    // With CX = 0 nothing runs, and CX is not written either.
    if (cx !== start) ctx.writeRegister('cx', cx);
  }
}
