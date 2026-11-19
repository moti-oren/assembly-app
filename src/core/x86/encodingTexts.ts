import { fillText, type Said, type TextParams } from '../shared/text';

/**
 * What each field of an 8086 instruction's machine code says about itself, as templates (see
 * `shared/text.ts`). A key per sentence, so a translation is a table with the same keys.
 */
export const ENCODING_TEXTS = {
  // The opcode byte
  wholeByte: '{name}: the whole instruction is this byte',
  shortDistance: '{name} with an 8-bit distance',
  groupSignExtended: 'Group: r/m16 with an 8-bit immediate that is sign-extended to 16 bits',
  groupImmediate: 'Group: r/m{size} with a {size}-bit immediate',
  accumulatorImmediate: '{name} {register}, imm{size}: a short form with no ModR/M',
  groupArithmetic: 'Group: one-operand arithmetic on r/m{size}',
  groupShift: 'Group: shift r/m{size} by {count}',
  movSegmentFrom: 'MOV sreg, r/m16',
  movSegmentTo: 'MOV r/m16, sreg',
  movRegisterImmediate:
    'MOV r{size}, imm{size}: {base} + the register number ({register} = {number})',
  movMemoryImmediate: 'MOV r/m{size}, imm{size}',
  movFromAddress: 'MOV {register}, [address]: a short form with no ModR/M',
  movToAddress: 'MOV [address], {register}: a short form with no ModR/M',
  xchgAccumulator: 'XCHG AX, r16: 90 + the register number ({register} = {number})',
  xchgMemory: 'XCHG r{size}, r/m{size}',
  registerFromRm: '{name} r{size}, r/m{size}',
  rmFromRegister: '{name} r/m{size}, r{size}',
  testAccumulator: 'TEST {register}, imm{size}: a short form with no ModR/M',
  pushPopSegment:
    '{name} sreg: the segment register number ({register} = {number}) sits in bits 3 and 4',
  registerPlusNumber: '{name} r16: {base} + the register number ({register} = {number})',
  groupOneOperand16: 'Group: one-operand instructions on r/m16',
  popMemory: 'POP r/m16',
  groupOneOperand: 'Group: one-operand instructions on r/m{size}',
  jmpNear: 'JMP with a 16-bit distance (near)',
  jmpShort: 'JMP with an 8-bit distance (short)',
  callNear: 'CALL with a 16-bit distance',
  portInDx: '{name} through the port in DX, {size} bits',
  portFixed: '{name} through a fixed port, {size} bits',
  int3: 'INT 3: its own one-byte opcode, made for breakpoints',
  intNumber: 'INT',
  repeatPrefix: '{prefix}: repeat the string instruction that follows while CX ≠ 0',

  // What follows the opcode
  immediateSignExtended: 'The immediate, stored in one byte and sign-extended',
  immediateLowFirst: 'The immediate, low byte first',
  labelOffset: 'The offset of {label} in the code, low byte first',
  addressLowFirst: 'The 16-bit address, low byte first',
  displacementZero: 'A zero displacement: [BP] cannot be encoded without one',
  displacement8: 'The 8-bit displacement, sign-extended and added to the register',
  displacement16: 'The 16-bit displacement, low byte first, added to the register',
  portNumber: 'The port number',
  interruptNumber: 'The interrupt number',
  distance: 'The distance to jump, counted from the next instruction: {sum}, so {distance}',
  distanceSum: '{label} is at {destination}h and the next instruction at {next}h',

  // The ModR/M byte and the fields in it
  modrm: 'ModR/M: which register and which register or memory location the opcode works on',
  modRegister: '11: r/m is a register',
  modDirect: '00 with r/m 110: a direct address follows',
  modMemory: '00: memory, no displacement',
  modDisplacement8: '01: memory, an 8-bit displacement follows',
  modDisplacement16: '10: memory, a 16-bit displacement follows',
  regRegister: '{bits} = {register}',
  regExtension: "{bits} = /{number}: picks {name} from this opcode's group",
  rmRegister: '{bits} = {register}',
  rmDirect: '110 = direct address',
  rmBase: '{bits} = [{base}]',

  // A field the 8086 cannot encode as written
  tooFar:
    'Too far for a conditional jump: it reaches −128 to +127 bytes and {label} is {distance} away. Jump on the opposite condition over a JMP to the target.'
} as const;

export type EncodingTextKey = keyof typeof ENCODING_TEXTS;

/** A sentence about a field: in English for the tests and the English interface, and as a key. */
export interface Spoken {
  note: string;
  say: Said<EncodingTextKey>;
}

export function said(key: EncodingTextKey, params: TextParams = {}): Spoken {
  return { note: fillText(ENCODING_TEXTS[key], params), say: { key, params } };
}
