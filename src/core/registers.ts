import type { Size } from './numbers';

export const GENERAL_REGISTERS = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'] as const;
export const SEGMENT_REGISTERS = ['cs', 'ds', 'es', 'ss'] as const;
export const BYTE_REGISTERS = ['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'] as const;
export const WORD_REGISTERS = [...GENERAL_REGISTERS, ...SEGMENT_REGISTERS, 'ip'] as const;

export type GeneralRegister = (typeof GENERAL_REGISTERS)[number];
export type SegmentRegister = (typeof SEGMENT_REGISTERS)[number];
export type ByteRegister = (typeof BYTE_REGISTERS)[number];
export type WordRegister = (typeof WORD_REGISTERS)[number];
export type RegisterName = WordRegister | ByteRegister;

/** AL..DH are not separate storage: each one is the high or low half of AX..DX. */
export const BYTE_REGISTER_LOCATION: Record<
  ByteRegister,
  { parent: 'ax' | 'bx' | 'cx' | 'dx'; high: boolean }
> = {
  al: { parent: 'ax', high: false },
  ah: { parent: 'ax', high: true },
  bl: { parent: 'bx', high: false },
  bh: { parent: 'bx', high: true },
  cl: { parent: 'cx', high: false },
  ch: { parent: 'cx', high: true },
  dl: { parent: 'dx', high: false },
  dh: { parent: 'dx', high: true }
};

export const REGISTER_DESCRIPTIONS: Record<WordRegister, string> = {
  ax: 'Accumulator: implicit operand of MUL/DIV',
  bx: 'Base: can address memory ([bx])',
  cx: 'Counter: CL holds the shift/rotate count',
  dx: 'Data: high word of MUL/DIV results',
  si: 'Source index',
  di: 'Destination index',
  bp: 'Base pointer: addresses the stack segment ([bp])',
  sp: 'Stack pointer: top of the stack (SS:SP)',
  cs: 'Code segment',
  ds: 'Data segment: default for memory operands',
  es: 'Extra segment',
  ss: 'Stack segment: used by PUSH/POP and [bp]',
  ip: 'Instruction pointer: the next program line to run'
};

/** The word registers whose two halves are byte registers of their own (AH and AL for AX). */
export const SPLIT_REGISTERS: readonly WordRegister[] = ['ax', 'bx', 'cx', 'dx'];

/** The registers whose value differs between two moments, in the usual register order. */
export function changedRegisters(
  before: Record<WordRegister, number>,
  after: Record<WordRegister, number>
): WordRegister[] {
  return WORD_REGISTERS.filter((name) => before[name] !== after[name]);
}

export function isByteRegister(name: RegisterName): name is ByteRegister {
  return name in BYTE_REGISTER_LOCATION;
}

export function isSegmentRegister(name: RegisterName): name is SegmentRegister {
  return (SEGMENT_REGISTERS as readonly string[]).includes(name);
}

export function isGeneralRegister(name: RegisterName): name is GeneralRegister {
  return (GENERAL_REGISTERS as readonly string[]).includes(name);
}

export function registerSize(name: RegisterName): Size {
  return isByteRegister(name) ? 8 : 16;
}
