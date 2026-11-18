import { fitsIn, formatHex, type Size } from '../shared/numbers';
import { formatLabel } from '../shared/program';
import {
  isByteRegister,
  isGeneralRegister,
  isSegmentRegister,
  registerSize,
  type RegisterName
} from './registers';
import { physicalAddress, readRegister, type RegisterFile } from './state';

/** Registers the 8086 accepts on their own inside [ ]. */
export const MEMORY_BASES = ['bx', 'si', 'di', 'bp'] as const;
export type MemoryBase = (typeof MEMORY_BASES)[number];

export type Operand =
  | { type: 'reg'; name: RegisterName }
  | { type: 'imm'; value: number }
  | { type: 'mem'; size: Size; base: MemoryBase | null; displacement: number }
  /** A jump/call target: the index of a program line. */
  | { type: 'label'; target: number };

/**
 * The operand categories an instruction form can ask for.
 * - `sregw` is a segment register that may be written (everything except CS).
 * - `one` is the literal 1 and `cl` is the CL register: the only shift counts the 8086 allows.
 * - `al`, `ax` and `dx` are those registers alone: IN and OUT accept no others.
 */
export type OperandKind =
  | 'r8'
  | 'r16'
  | 'sreg'
  | 'sregw'
  | 'cl'
  | 'al'
  | 'ax'
  | 'dx'
  | 'one'
  | 'imm8'
  | 'imm16'
  | 'm8'
  | 'm16'
  | 'label';

export function matchesKind(kind: OperandKind, operand: Operand): boolean {
  switch (operand.type) {
    case 'reg': {
      const { name } = operand;
      switch (kind) {
        case 'r8':
          return isByteRegister(name);
        case 'r16':
          return isGeneralRegister(name);
        case 'sreg':
          return isSegmentRegister(name);
        case 'sregw':
          return isSegmentRegister(name) && name !== 'cs';
        case 'cl':
        case 'al':
        case 'ax':
        case 'dx':
          return name === kind;
        default:
          return false;
      }
    }
    case 'imm':
      switch (kind) {
        case 'imm8':
          return fitsIn(operand.value, 8);
        case 'imm16':
          return fitsIn(operand.value, 16);
        case 'one':
          return operand.value === 1;
        default:
          return false;
      }
    case 'mem':
      return (kind === 'm8' && operand.size === 8) || (kind === 'm16' && operand.size === 16);
    case 'label':
      return kind === 'label';
  }
}

/** Size of a register or memory operand; immediates take the size of the other operand. */
export function operandSize(operand: Operand): Size | null {
  switch (operand.type) {
    case 'reg':
      return registerSize(operand.name);
    case 'mem':
      return operand.size;
    case 'imm':
    case 'label':
      return null;
  }
}

/** DS is the default segment, except for [bp], which uses SS. */
export function memorySegment(operand: Extract<Operand, { type: 'mem' }>): 'ds' | 'ss' {
  return operand.base === 'bp' ? 'ss' : 'ds';
}

export function effectiveOffset(
  state: RegisterFile,
  operand: Extract<Operand, { type: 'mem' }>
): number {
  const base = operand.base ? readRegister(state, operand.base) : 0;
  return (base + operand.displacement) & 0xffff;
}

export function effectiveAddress(
  state: RegisterFile,
  operand: Extract<Operand, { type: 'mem' }>
): number {
  const segment = readRegister(state, memorySegment(operand));
  return physicalAddress(segment, effectiveOffset(state, operand));
}

export function formatImmediate(value: number): string {
  // Small and negative values read best in decimal, everything else in hex.
  if (value < 10) {
    return String(value);
  }
  return `0x${value.toString(16).toUpperCase()}`;
}

export function formatOperand(operand: Operand): string {
  switch (operand.type) {
    case 'reg':
      return operand.name;
    case 'imm':
      return formatImmediate(operand.value);
    case 'mem': {
      const sizeName = operand.size === 8 ? 'byte' : 'word';
      const parts: string[] = [];
      if (operand.base) {
        parts.push(operand.base);
      }
      if (operand.displacement || !operand.base) {
        parts.push(`0x${formatHex(operand.displacement, 16)}`);
      }
      return `${sizeName} [${parts.join('+')}]`;
    }
    case 'label':
      return formatLabel(operand.target);
  }
}
