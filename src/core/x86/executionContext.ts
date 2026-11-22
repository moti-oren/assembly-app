import { CpuError } from '../shared/cpuError';
import { FLAGS_MASK, FLAGS_RESERVED, type FlagName } from './flags';
import { formatHex, hasEvenParity, mask, signBit, truncate, type Size } from '../shared/numbers';
import { effectiveOffset, memorySegment, type Operand } from './operands';
import type { RegisterName, SegmentRegister } from './registers';
import {
  getFlag,
  readRegister,
  readSegmented,
  setFlag,
  writeRegister,
  writeSegmented,
  type CpuState
} from './state';
import { readMemory, type MemoryWrite, type PortWrite } from '../shared/state';

/** What AND, OR, XOR and TEST do to each pair of bits. */
export type LogicOperation = 'and' | 'or' | 'xor';

const LOGIC: Record<LogicOperation, (a: number, b: number) => number> = {
  and: (a, b) => a & b,
  or: (a, b) => a | b,
  xor: (a, b) => a ^ b
};

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
  | { kind: 'logic'; size: Size; operation: LogicOperation; a: number; b: number; result: number }
  | { kind: 'shift'; size: Size; original: number; count: number; result: number; carry: boolean }
  | { kind: 'multiply'; size: Size; signed: boolean; product: number; overflow: boolean }
  /** POPF and IRET: nothing is computed, FLAGS is loaded whole from the stack. */
  | { kind: 'restore'; flags: number };

/** Each interrupt vector is 4 bytes at the bottom of memory: the handler's IP, then its CS. */
export const VECTOR_SIZE = 4;
export const DIVIDE_ERROR_INTERRUPT = 0;
export const OVERFLOW_INTERRUPT = 4;

/**
 * What one instruction runs against: reads and writes that the undo record keeps track of,
 * the flags, the ALU, the stack and interrupts.
 */
export class ExecutionContext {
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
        return this.readAt(memorySegment(operand), effectiveOffset(this.state, operand));
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
        this.writeAt(memorySegment(operand), effectiveOffset(this.state, operand), value);
        return;
      case 'imm':
      case 'label':
        throw new CpuError(
          `${operand.type === 'imm' ? 'A number' : 'A line label'} can't be a destination. Pick a register or memory first.`
        );
    }
  }

  /** Memory at segment:offset, the instruction's size unless another is given. */
  readAt(segment: SegmentRegister, offset: number, size: Size = this.size): number {
    return readSegmented(this.state, readRegister(this.state, segment), offset, size);
  }

  writeAt(segment: SegmentRegister, offset: number, value: number, size: Size = this.size): void {
    const base = readRegister(this.state, segment);
    this.memoryWrites.push(...writeSegmented(this.state, base, offset, size, value));
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

  logic(operation: LogicOperation, a: number, b: number): number {
    const result = truncate(LOGIC[operation](a, b), this.size);
    this.setFlag('CF', false);
    this.setFlag('OF', false);
    this.setFlag('AF', false);
    this.setResultFlags(result);
    this.alu = { kind: 'logic', size: this.size, operation, a, b, result };
    return result;
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
    this.writeAt('ss', sp, value, 16);
  }

  pop(): number {
    const sp = readRegister(this.state, 'sp');
    const value = this.readAt('ss', sp, 16);
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

/** What one mnemonic does, given the context and its operands. */
export type Handler = (ctx: ExecutionContext, operands: Operand[]) => void;
