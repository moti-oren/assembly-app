import { formatLabel } from '../shared/program';

/**
 * The 13 addressing modes: where an instruction finds its operand.
 * imp implied, acc the accumulator, imm immediate, zp/zpx/zpy the zero page (plus X or Y),
 * abs/abx/aby an absolute address (plus X or Y), ind indirect (JMP only), izx `($nn,X)`,
 * izy `($nn),Y`, rel a branch's signed 8-bit distance.
 */
export type Mode =
  | 'imp'
  | 'acc'
  | 'imm'
  | 'zp'
  | 'zpx'
  | 'zpy'
  | 'abs'
  | 'abx'
  | 'aby'
  | 'ind'
  | 'izx'
  | 'izy'
  | 'rel';

export type Index = 'x' | 'y';

export type Operand =
  | { type: 'acc' }
  | { type: 'imm'; value: number }
  | { type: 'zp'; address: number; index: Index | null }
  | { type: 'abs'; address: number; index: Index | null }
  /** JMP ($nnnn): the target is the word stored at the address. */
  | { type: 'ind'; address: number }
  /** ($nn,X): a pointer in the zero page, picked by adding X. */
  | { type: 'izx'; address: number }
  /** ($nn),Y: a pointer in the zero page, then Y added to it. */
  | { type: 'izy'; address: number }
  /** A jump or branch target: the index of a program line. */
  | { type: 'label'; target: number };

/** The mode an operand stands for. A label is relative for a branch and absolute for JMP or JSR. */
export function modeOf(operand: Operand | undefined, branch: boolean): Mode {
  if (!operand) return 'imp';
  switch (operand.type) {
    case 'acc':
    case 'imm':
    case 'ind':
    case 'izx':
    case 'izy':
      return operand.type;
    case 'zp':
      return operand.index === null ? 'zp' : operand.index === 'x' ? 'zpx' : 'zpy';
    case 'abs':
      return operand.index === null ? 'abs' : operand.index === 'x' ? 'abx' : 'aby';
    case 'label':
      return branch ? 'rel' : 'abs';
  }
}

/** Bytes after the opcode in each mode. */
export const OPERAND_BYTES: Record<Mode, number> = {
  imp: 0,
  acc: 0,
  imm: 1,
  zp: 1,
  zpx: 1,
  zpy: 1,
  abs: 2,
  abx: 2,
  aby: 2,
  ind: 2,
  izx: 1,
  izy: 1,
  rel: 1
};

export const MODE_NAMES: Record<Mode, string> = {
  imp: 'implied',
  acc: 'accumulator',
  imm: 'immediate',
  zp: 'zero page',
  zpx: 'zero page,X',
  zpy: 'zero page,Y',
  abs: 'absolute',
  abx: 'absolute,X',
  aby: 'absolute,Y',
  ind: 'indirect',
  izx: '(indirect,X)',
  izy: '(indirect),Y',
  rel: 'relative'
};

export function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, '0');
}

export function formatOperand(operand: Operand): string {
  switch (operand.type) {
    case 'acc':
      return 'a';
    case 'imm':
      return `#$${hex(operand.value & 0xff, 2)}`;
    case 'zp':
      return `$${hex(operand.address, 2)}${operand.index ? `,${operand.index}` : ''}`;
    case 'abs':
      return `$${hex(operand.address, 4)}${operand.index ? `,${operand.index}` : ''}`;
    case 'ind':
      return `($${hex(operand.address, 4)})`;
    case 'izx':
      return `($${hex(operand.address, 2)},x)`;
    case 'izy':
      return `($${hex(operand.address, 2)}),y`;
    case 'label':
      return formatLabel(operand.target);
  }
}
