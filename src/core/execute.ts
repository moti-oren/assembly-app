import { FLAGS_MASK, FLAGS_RESERVED, type FlagName } from './flags';
import {
  formatInstruction,
  instructionSize,
  isValid,
  type Instruction,
  type Mnemonic,
  type RepeatPrefix
} from './instructions';
import { formatHex, hasEvenParity, mask, signBit, toSigned, truncate, type Size } from './numbers';
import { effectiveAddress, type Operand } from './operands';
import type { RegisterName, SegmentRegister } from './registers';
import {
  getFlag,
  physicalAddress,
  readMemory,
  readPort,
  readRegister,
  redoPortWrite,
  setFlag,
  snapshot,
  undoPortWrite,
  writeMemory,
  writePort,
  writeRegister,
  type CpuSnapshot,
  type CpuState,
  type MemoryWrite,
  type PortWrite
} from './state';

/** An error the CPU itself would raise (e.g. divide error), or an invalid instruction. */
export class CpuError extends Error {
  override name = 'CpuError';
}

/** What the ALU computed, kept so the flags it produced can be explained afterwards. */
export type AluTrace =
  | {
      kind: 'add' | 'subtract';
      size: Size;
      a: number;
      b: number;
      /** CF going in (ADC, SBB), otherwise 0. */
      carryIn: number;
      result: number;
      /** False for INC and DEC, which leave CF alone. */
      updatesCarry: boolean;
    }
  | { kind: 'logic'; size: Size; result: number }
  | { kind: 'shift'; size: Size; original: number; count: number; result: number; carry: boolean }
  | { kind: 'multiply'; size: Size; signed: boolean; product: number; overflow: boolean }
  /** POPF and IRET: nothing is computed, FLAGS is loaded whole from the stack. */
  | { kind: 'restore'; flags: number };

/** A divide error is interrupt 0; it only surfaces as an error when no handler is installed. */
class DivideError extends CpuError {}

/** Each interrupt vector is 4 bytes at the bottom of memory: the handler's IP, then its CS. */
export const VECTOR_SIZE = 4;
const DIVIDE_ERROR_INTERRUPT = 0;
const OVERFLOW_INTERRUPT = 4;

/** Everything needed to undo one executed instruction. */
export interface ExecutionRecord {
  instruction: Instruction;
  /** The program line it was fetched from, or null when it was run directly. */
  line: number | null;
  before: CpuSnapshot;
  memoryWrites: MemoryWrite[];
  /** Bytes OUT latched into I/O ports. */
  portWrites: PortWrite[];
  /** Null when the instruction computed nothing in the ALU, e.g. MOV, a jump, or a shift by 0. */
  alu: AluTrace | null;
  /** The interrupt the instruction entered (INT n, INTO, a divide error), or null. */
  interrupt: number | null;
  /**
   * Registers the instruction wrote, whether or not the value changed: byte registers by their
   * own name (AL, not AX), each once. The fetch moving IP to the next line is not one of them.
   */
  registersWritten: RegisterName[];
}

class ExecutionContext {
  readonly memoryWrites: MemoryWrite[] = [];
  readonly portWrites: PortWrite[] = [];
  readonly registersWritten: RegisterName[] = [];
  alu: AluTrace | null = null;
  interrupted: number | null = null;

  constructor(
    readonly state: CpuState,
    /** Operand size of the instruction: the size of its register or memory operand. */
    readonly size: Size
  ) {}

  read(operand: Operand): number {
    switch (operand.type) {
      case 'reg':
        return readRegister(this.state, operand.name);
      case 'imm':
        return truncate(operand.value, this.size);
      case 'mem':
        return readMemory(this.state, effectiveAddress(this.state, operand), this.size);
      case 'label':
        // As a value, a label is the number of its program line.
        return operand.target;
    }
  }

  /** Every register the instruction writes goes through here, so the record can list it. */
  writeRegister(name: RegisterName, value: number): void {
    writeRegister(this.state, name, value);
    if (!this.registersWritten.includes(name)) this.registersWritten.push(name);
  }

  write(operand: Operand, value: number): void {
    switch (operand.type) {
      case 'reg':
        this.writeRegister(operand.name, value);
        return;
      case 'mem':
        this.memoryWrites.push(
          ...writeMemory(this.state, effectiveAddress(this.state, operand), this.size, value)
        );
        return;
      case 'imm':
      case 'label':
        throw new CpuError(
          `${operand.type === 'imm' ? 'A number' : 'A line label'} can't be a destination. Pick a register or memory first.`
        );
    }
  }

  /** Memory at segment:offset, for instructions that address it without a memory operand. */
  readAt(segment: SegmentRegister, offset: number): number {
    const address = physicalAddress(readRegister(this.state, segment), offset);
    return readMemory(this.state, address, this.size);
  }

  writeAt(segment: SegmentRegister, offset: number, value: number): void {
    const address = physicalAddress(readRegister(this.state, segment), offset);
    this.memoryWrites.push(...writeMemory(this.state, address, this.size, value));
  }

  jump(target: Operand): void {
    if (target.type !== 'label') {
      throw new CpuError('A jump needs a program line (L0, L1, …) as its target.');
    }
    this.writeRegister('ip', target.target);
  }

  flag(name: FlagName): boolean {
    return getFlag(this.state, name);
  }

  setFlag(name: FlagName, value: boolean): void {
    setFlag(this.state, name, value);
  }

  /** ZF, SF and PF, which almost every arithmetic and logic result sets the same way. */
  setResultFlags(result: number): void {
    this.setFlag('ZF', truncate(result, this.size) === 0);
    this.setFlag('SF', (result & signBit(this.size)) !== 0);
    this.setFlag('PF', hasEvenParity(result));
  }

  add(a: number, b: number, carryIn: number, updateCarry = true): number {
    const raw = a + b + carryIn;
    const result = truncate(raw, this.size);
    if (updateCarry) {
      this.setFlag('CF', raw > mask(this.size));
    }
    this.setFlag('OF', ((a ^ result) & (b ^ result) & signBit(this.size)) !== 0);
    this.setFlag('AF', ((a ^ b ^ result) & 0x10) !== 0);
    this.setResultFlags(result);
    this.alu = { kind: 'add', size: this.size, a, b, carryIn, result, updatesCarry: updateCarry };
    return result;
  }

  subtract(a: number, b: number, borrowIn: number, updateCarry = true): number {
    const raw = a - b - borrowIn;
    const result = truncate(raw, this.size);
    if (updateCarry) {
      this.setFlag('CF', raw < 0);
    }
    this.setFlag('OF', ((a ^ b) & (a ^ result) & signBit(this.size)) !== 0);
    this.setFlag('AF', ((a ^ b ^ result) & 0x10) !== 0);
    this.setResultFlags(result);
    this.alu = {
      kind: 'subtract',
      size: this.size,
      a,
      b,
      carryIn: borrowIn,
      result,
      updatesCarry: updateCarry
    };
    return result;
  }

  logic(result: number): number {
    this.setFlag('CF', false);
    this.setFlag('OF', false);
    this.setFlag('AF', false);
    this.setResultFlags(result);
    this.alu = { kind: 'logic', size: this.size, result: truncate(result, this.size) };
    return truncate(result, this.size);
  }

  /** MUL and IMUL: CF and OF both say whether the upper half of the product is significant. */
  setProductFlags(product: number, signed: boolean, overflow: boolean): void {
    this.setFlag('CF', overflow);
    this.setFlag('OF', overflow);
    this.alu = { kind: 'multiply', size: this.size, signed, product, overflow };
  }

  push(value: number): void {
    const sp = truncate(readRegister(this.state, 'sp') - 2, 16);
    this.writeRegister('sp', sp);
    const address = physicalAddress(readRegister(this.state, 'ss'), sp);
    this.memoryWrites.push(...writeMemory(this.state, address, 16, value));
  }

  pop(): number {
    const sp = readRegister(this.state, 'sp');
    const value = readMemory(this.state, physicalAddress(readRegister(this.state, 'ss'), sp), 16);
    this.writeRegister('sp', sp + 2);
    return value;
  }

  /** The handler of interrupt `type` as its vector holds it, or null while the vector is empty. */
  handler(type: number): { ip: number; cs: number } | null {
    const vector = type * VECTOR_SIZE;
    const ip = readMemory(this.state, vector, 16);
    const cs = readMemory(this.state, vector + 2, 16);
    return ip === 0 && cs === 0 ? null : { ip, cs };
  }

  /**
   * Enters interrupt `type`: pushes FLAGS, CS and IP, clears IF and TF so the handler is not
   * itself interrupted, and loads CS:IP from the vector. IP is a program line, as everywhere.
   * A real 8086 would jump to 0000:0000 through an empty vector; here that is an error.
   */
  interrupt(type: number): void {
    const handler = this.handler(type);
    if (!handler) {
      const vector = formatHex(type * VECTOR_SIZE, 16);
      throw new CpuError(
        `INT ${formatHex(type, 8)}h has no handler yet: its vector at 0000:${vector} is empty. ` +
          `Store the handler's line in that vector first (see the "Software interrupt" example).`
      );
    }
    this.push(this.state.flags);
    this.setFlag('IF', false);
    this.setFlag('TF', false);
    this.push(readRegister(this.state, 'cs'));
    this.push(readRegister(this.state, 'ip'));
    this.writeRegister('cs', handler.cs);
    this.writeRegister('ip', handler.ip);
    this.interrupted = type;
  }

  /** Loads FLAGS from a word off the stack. Only the real flag bits can change. */
  restoreFlags(value: number): void {
    this.state.flags = (value & FLAGS_MASK) | FLAGS_RESERVED;
    this.alu = { kind: 'restore', flags: this.state.flags };
  }
}

type Handler = (ctx: ExecutionContext, operands: Operand[]) => void;

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

type ShiftMnemonic = 'shl' | 'shr' | 'sar' | 'rol' | 'ror' | 'rcl' | 'rcr';

const shift =
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

type StringOperation = 'movs' | 'stos' | 'lods' | 'scas' | 'cmps';

/** One element of a string instruction: the source is DS:SI, the destination is ES:DI. */
const stringStep =
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
function repeat(ctx: ExecutionContext, prefix: RepeatPrefix, step: () => void): void {
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

/** The port of IN and OUT: an 8-bit number in the instruction, or whatever DX holds. */
function portNumber(ctx: ExecutionContext, operand: Operand): number {
  return operand.type === 'imm' ? operand.value & 0xff : readRegister(ctx.state, 'dx');
}

const signedLess = (ctx: ExecutionContext) => ctx.flag('SF') !== ctx.flag('OF');

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

const HANDLERS: Record<Mnemonic, Handler> = {
  mov: (ctx, [dst, src]) => ctx.write(dst, ctx.read(src)),
  xchg: (ctx, [a, b]) => {
    const valueA = ctx.read(a);
    const valueB = ctx.read(b);
    ctx.write(a, valueB);
    ctx.write(b, valueA);
  },
  push: (ctx, [src]) => ctx.push(ctx.read(src)),
  pop: (ctx, [dst]) => ctx.write(dst, ctx.pop()),

  add: binary((ctx, a, b) => ctx.add(a, b, 0)),
  adc: binary((ctx, a, b) => ctx.add(a, b, ctx.flag('CF') ? 1 : 0)),
  sub: binary((ctx, a, b) => ctx.subtract(a, b, 0)),
  sbb: binary((ctx, a, b) => ctx.subtract(a, b, ctx.flag('CF') ? 1 : 0)),
  cmp: binary((ctx, a, b) => ctx.subtract(a, b, 0), false),
  inc: unary((ctx, value) => ctx.add(value, 1, 0, false)),
  dec: unary((ctx, value) => ctx.subtract(value, 1, 0, false)),
  neg: unary((ctx, value) => ctx.subtract(0, value, 0)),

  mul: (ctx, [src]) => {
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
  },
  imul: (ctx, [src]) => {
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
  },
  div: (ctx, [src]) => {
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
  },
  idiv: (ctx, [src]) => {
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
  },

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

/**
 * Runs one instruction against `state`. Either the whole instruction takes effect or,
 * if it raises a CpuError, the state is left exactly as it was.
 *
 * `line` is the program line the instruction was fetched from. As on a real CPU, IP is
 * advanced to the next line before the instruction runs, so jumps simply overwrite it and
 * CALL pushes the right return address. Instructions run directly (line = null) leave IP alone.
 */
export function execute(
  state: CpuState,
  instruction: Instruction,
  line: number | null = null
): ExecutionRecord {
  if (!isValid(instruction)) {
    throw new CpuError(
      `${formatInstruction(instruction)} isn't a valid 8086 instruction. Remove the last word and pick again.`
    );
  }

  const ctx = new ExecutionContext(state, instructionSize(instruction) ?? 16);
  const record: ExecutionRecord = {
    instruction,
    line,
    before: snapshot(state),
    memoryWrites: ctx.memoryWrites,
    portWrites: ctx.portWrites,
    alu: null,
    interrupt: null,
    registersWritten: ctx.registersWritten
  };

  try {
    if (line !== null) {
      writeRegister(state, 'ip', line + 1);
    }
    const handler = HANDLERS[instruction.mnemonic];
    try {
      if (instruction.prefix) {
        repeat(ctx, instruction.prefix, () => handler(ctx, instruction.operands));
      } else {
        handler(ctx, instruction.operands);
      }
    } catch (error) {
      // DIV and IDIV raise the error before changing anything, so the interrupt starts clean.
      const handled = error instanceof DivideError && ctx.handler(DIVIDE_ERROR_INTERRUPT);
      if (!handled) throw error;
      ctx.interrupt(DIVIDE_ERROR_INTERRUPT);
    }
    record.interrupt = ctx.interrupted;
    record.alu = ctx.alu;
  } catch (error) {
    undo(state, record);
    throw error;
  }

  return record;
}

export function undo(state: CpuState, record: ExecutionRecord): void {
  Object.assign(state.registers, record.before.registers);
  state.flags = record.before.flags;
  for (let i = record.memoryWrites.length - 1; i >= 0; i--) {
    const write = record.memoryWrites[i];
    state.memory[write.address] = write.before;
  }
  if (record.memoryWrites.length > 0) {
    state.memoryVersion++;
  }
  for (let i = record.portWrites.length - 1; i >= 0; i--) {
    undoPortWrite(state, record.portWrites[i]);
  }
}

/** Re-applies an undone record without running it again: the inverse of `undo`. */
export function redo(state: CpuState, record: ExecutionRecord, after: CpuSnapshot): void {
  Object.assign(state.registers, after.registers);
  state.flags = after.flags;
  for (const write of record.memoryWrites) {
    state.memory[write.address] = write.after;
  }
  if (record.memoryWrites.length > 0) {
    state.memoryVersion++;
  }
  for (const write of record.portWrites) {
    redoPortWrite(state, write);
  }
}
