import { fitsSigned, fitsUnsigned } from './bits';
import { ABI_NAMES } from './registers';

/**
 * Operands as RISC-V assembly writes them. A register is kept by number and shown by its ABI
 * name. Memory is always `offset(base)`: one register plus a 12-bit signed offset.
 */
export type Operand =
  | { type: 'reg'; index: number }
  | { type: 'imm'; value: number }
  | { type: 'mem'; base: number; offset: number }
  /** A branch or jump target: the index of a program line. */
  | { type: 'label'; target: number };

/**
 * The operand categories an instruction form can ask for.
 * - `imm12` is a 12-bit signed immediate, -2048 to 2047: the I-type and S-type field.
 * - `shamt` is a shift amount, 0 to 31.
 * - `imm20` is the 20 upper bits LUI and AUIPC place above 12 zero bits, 0 to 0xFFFFF.
 * - `mem` is `offset(base)` with a 12-bit signed offset.
 */
export type OperandKind = 'reg' | 'imm12' | 'shamt' | 'imm20' | 'mem' | 'label';

export function matchesKind(kind: OperandKind, operand: Operand): boolean {
  switch (operand.type) {
    case 'reg':
      return kind === 'reg' && fitsUnsigned(operand.index, 5);
    case 'imm':
      if (kind === 'imm12') return fitsSigned(operand.value, 12);
      if (kind === 'shamt') return fitsUnsigned(operand.value, 5);
      if (kind === 'imm20') return fitsUnsigned(operand.value, 20);
      return false;
    case 'mem':
      return kind === 'mem' && fitsUnsigned(operand.base, 5) && fitsSigned(operand.offset, 12);
    case 'label':
      return kind === 'label';
  }
}

export function formatRegister(index: number): string {
  return ABI_NAMES[index];
}

export function formatLabel(target: number): string {
  return `L${target}`;
}

/** Small and negative numbers read best in decimal, larger ones in hex, as in a disassembly. */
function formatImmediate(value: number): string {
  return value < 10 ? String(value) : `0x${value.toString(16)}`;
}

export function formatOperand(operand: Operand): string {
  switch (operand.type) {
    case 'reg':
      return formatRegister(operand.index);
    case 'imm':
      return formatImmediate(operand.value);
    case 'mem':
      return `${operand.offset}(${formatRegister(operand.base)})`;
    case 'label':
      return formatLabel(operand.target);
  }
}
