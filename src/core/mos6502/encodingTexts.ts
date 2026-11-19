import { fillText, type Said, type TextParams } from '../shared/text';

/** What each field of a 6502 instruction says about itself, as templates. */
export const MOS6502_ENCODING_TEXTS = {
  opcode: '{name}, {mode}: one byte for both',
  valueItself: 'The value itself',
  zeroPage: 'The zero-page address',
  zeroPageIndexed: 'The zero-page address, before {index} is added',
  pointerAddress: 'Where in the zero page the pointer is',
  lowAddress: 'Low byte of the address',
  highAddress: 'High byte of the address',
  lowAddressIndexed: 'Low byte of the address, before {index} is added',
  highAddressIndexed: 'High byte of the address, before {index} is added',
  lowStored: 'Low byte of where the target address is stored',
  highStored: 'High byte of where the target address is stored',
  lowTarget: "Low byte of {label}'s address, {address}",
  highTarget: "High byte of {label}'s address, {address}",
  branchDistance: 'How far to branch from the next instruction at {next}: {distance}',
  signature: 'Signature byte: BRK skips it, so the return lands after it',
  outOfRange:
    'Out of range: a branch reaches only 128 bytes back or 127 ahead, and {label} is {distance} away',
  cyclesBranch: '{cycles} (+1 if taken, +1 more across a page)',
  cyclesPage: '{cycles} (+1 across a page)'
} as const;

export type Mos6502EncodingTextKey = keyof typeof MOS6502_ENCODING_TEXTS;

export interface Mos6502Spoken {
  note: string;
  say: Said<Mos6502EncodingTextKey>;
}

export function mos6502Said(key: Mos6502EncodingTextKey, params: TextParams = {}): Mos6502Spoken {
  return { note: fillText(MOS6502_ENCODING_TEXTS[key], params), say: { key, params } };
}
