import { matchingForms, type Mnemonic } from './instructions';
import type { Size } from './numbers';
import { matchesKind, type Operand, type OperandKind } from './operands';
import {
  BYTE_REGISTERS,
  GENERAL_REGISTERS,
  SEGMENT_REGISTERS,
  type RegisterName
} from './registers';

/** What the instruction builder may offer for the next operand, given the choices so far. */
export interface OperandChoices {
  registers: RegisterName[];
  /** Size of the immediate that may be typed, or null when no immediate fits here. */
  immediate: Size | null;
  /** The literal 1 (shift/rotate count). */
  one: boolean;
  memory: Size[];
  /** A program line as a jump target. */
  label: boolean;
}

const SELECTABLE_REGISTERS: readonly RegisterName[] = [
  ...GENERAL_REGISTERS,
  ...BYTE_REGISTERS,
  ...SEGMENT_REGISTERS
];

function nextOperandKinds(mnemonic: Mnemonic, operands: readonly Operand[]): Set<OperandKind> {
  const kinds = new Set<OperandKind>();
  for (const form of matchingForms(mnemonic, operands)) {
    if (form.length > operands.length) {
      kinds.add(form[operands.length]);
    }
  }
  return kinds;
}

export function operandChoices(mnemonic: Mnemonic, operands: readonly Operand[]): OperandChoices {
  const kinds = [...nextOperandKinds(mnemonic, operands)];
  const accepts = (operand: Operand) => kinds.some((kind) => matchesKind(kind, operand));

  const immediate = kinds.includes('imm16') ? 16 : kinds.includes('imm8') ? 8 : null;
  const memory: Size[] = [];
  if (kinds.includes('m8')) memory.push(8);
  if (kinds.includes('m16')) memory.push(16);

  return {
    registers: SELECTABLE_REGISTERS.filter((name) => accepts({ type: 'reg', name })),
    immediate,
    one: immediate === null && kinds.includes('one'),
    memory,
    label: kinds.includes('label')
  };
}

export function hasMoreOperands(mnemonic: Mnemonic, operands: readonly Operand[]): boolean {
  return nextOperandKinds(mnemonic, operands).size > 0;
}
