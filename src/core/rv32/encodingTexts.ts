import { fillText, type Said, type TextParams } from '../shared/text';

/** What each field of a RISC-V instruction word says about itself, as templates. */
export const RV32_ENCODING_TEXTS = {
  register: '{abi} (x{index})',
  opcodeName: '{name}',
  opcodeOpImm: 'OP-IMM: register and immediate',
  opcodeOp: 'OP: register and register',
  picks: 'Picks {name} within its opcode',
  mulDiv: 'Marks a multiply or divide (the M extension)',
  shiftAmount: 'The shift amount, 0 to 31',
  immediateI: 'The 12-bit immediate, sign-extended when used',
  immediateS:
    'The 12-bit offset, split around rs1 and rs2 so they stay where every format has them',
  immediateBJ:
    'The distance to jump, in bytes from this instruction. It is always even, so bit 0 is not stored',
  immediateU: 'The upper 20 bits of the value; the low 12 are 0',
  outOfRangeBranch:
    'Out of range: a branch reaches only {reach} either way, and {label} is {distance} bytes away',
  outOfRangeJal:
    'Out of range: a JAL reaches only {reach} either way, and {label} is {distance} bytes away'
} as const;

export type Rv32EncodingTextKey = keyof typeof RV32_ENCODING_TEXTS;

export interface Rv32Spoken {
  note: string;
  say: Said<Rv32EncodingTextKey>;
}

export function rv32Said(key: Rv32EncodingTextKey, params: TextParams = {}): Rv32Spoken {
  return { note: fillText(RV32_ENCODING_TEXTS[key], params), say: { key, params } };
}
