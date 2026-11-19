import type { Mnemonic } from './instructions';
import { formatBits, formatHex, toSigned, truncate, type Size } from '../shared/numbers';
import { formatLabel } from '../shared/program';
import type { Said } from '../shared/text';
import { said, type EncodingTextKey, type Spoken } from './encodingTexts';
import { formatOperand, type MemoryBase, type Operand } from './operands';
import type { RegisterName } from './registers';

/** Which part of an instruction a field is; each is drawn in its own colour. */
export type FieldKind = 'prefix' | 'opcode' | 'modrm' | 'displacement' | 'immediate' | 'relative';

/** The three bit fields of a ModR/M byte, each with what its value selects. */
export interface ModRm {
  mod: number;
  reg: number;
  rm: number;
  modNote: string;
  regNote: string;
  rmNote: string;
  /** The same three, as keys of `encodingTexts.ts`, for another language to word. */
  modSay: Said<EncodingTextKey>;
  regSay: Said<EncodingTextKey>;
  rmSay: Said<EncodingTextKey>;
}

export interface EncodedField {
  kind: FieldKind;
  bytes: number[];
  /** What the field says, in English, and which sentence that is. */
  note: string;
  say: Said<EncodingTextKey>;
  modrm?: ModRm;
  /** Set on a field the 8086 cannot encode as written, e.g. a jump distance out of range. */
  problem?: string;
  problemSay?: Said<EncodingTextKey>;
}

export type Reg = Extract<Operand, { type: 'reg' }>;
export type Mem = Extract<Operand, { type: 'mem' }>;

/** Register numbers as the 8086 encodes them; the same 3 bits mean different registers by size. */
const WORD_NUMBERS = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
const BYTE_NUMBERS = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
const SEGMENT_NUMBERS = ['es', 'cs', 'ss', 'ds'];

export function registerNumber(name: RegisterName): number {
  for (const table of [WORD_NUMBERS, BYTE_NUMBERS, SEGMENT_NUMBERS]) {
    const index = table.indexOf(name);
    if (index >= 0) return index;
  }
  throw new Error(`No register number for ${name}`);
}

/** r/m values of the addressing modes the playground has: one register inside the brackets. */
const BASE_RM: Record<MemoryBase, number> = { si: 0b100, di: 0b101, bp: 0b110, bx: 0b111 };
const DIRECT_RM = 0b110;

export const hexByte = (value: number): string => formatHex(value, 8);
export const word = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
export const upper = (operand: Reg): string => operand.name.toUpperCase();
/** True when a 16-bit value is a sign-extended byte, so one byte is enough to store it. */
export const fitsSignedByte = (value: number): boolean => {
  const signed = toSigned(value, 16);
  return signed >= -128 && signed <= 127;
};

export function opcode(byte: number, spoken: Spoken): EncodedField {
  return { kind: 'opcode', bytes: [byte], ...spoken };
}

export function immediate(value: number, size: Size, spoken: Spoken): EncodedField {
  const bytes = size === 8 ? [value & 0xff] : word(value);
  return { kind: 'immediate', bytes, ...spoken };
}

/** What goes in the `reg` field: a register, or a number that picks one operation of a group. */
export interface RegField {
  number: number;
  note: string;
  say: Said<EncodingTextKey>;
}

export function registerField(operand: Reg): RegField {
  const number = registerNumber(operand.name);
  return {
    number,
    ...said('regRegister', { bits: formatBits(number, 3), register: upper(operand) })
  };
}

export function extension(number: number, name: string): RegField {
  return { number, ...said('regExtension', { bits: formatBits(number, 3), number, name }) };
}

/** The ModR/M byte for `reg` and a register or memory operand, plus the displacement it calls for. */
export function modRm(reg: RegField, operand: Reg | Mem): EncodedField[] {
  const build = (mod: number, rm: number, modSaid: Spoken, rmSaid: Spoken): EncodedField => ({
    kind: 'modrm',
    bytes: [(mod << 6) | (reg.number << 3) | rm],
    ...said('modrm'),
    modrm: {
      mod,
      reg: reg.number,
      rm,
      modNote: modSaid.note,
      regNote: reg.note,
      rmNote: rmSaid.note,
      modSay: modSaid.say,
      regSay: reg.say,
      rmSay: rmSaid.say
    }
  });

  if (operand.type === 'reg') {
    const rm = registerNumber(operand.name);
    const register = said('rmRegister', { bits: formatBits(rm, 3), register: upper(operand) });
    return [build(0b11, rm, said('modRegister'), register)];
  }

  const displacement = truncate(operand.displacement, 16);
  if (operand.base === null) {
    return [
      build(0b00, DIRECT_RM, said('modDirect'), said('rmDirect')),
      { kind: 'displacement', bytes: word(displacement), ...said('addressLowFirst') }
    ];
  }

  const rm = BASE_RM[operand.base];
  const rmSaid = said('rmBase', { bits: formatBits(rm, 3), base: operand.base.toUpperCase() });
  // [BP] has no form without a displacement: that slot (mod 00, r/m 110) is the direct address.
  if (displacement === 0 && operand.base !== 'bp') {
    return [build(0b00, rm, said('modMemory'), rmSaid)];
  }
  if (fitsSignedByte(displacement)) {
    const spoken = said(displacement === 0 ? 'displacementZero' : 'displacement8');
    return [
      build(0b01, rm, said('modDisplacement8'), rmSaid),
      { kind: 'displacement', bytes: [displacement & 0xff], ...spoken }
    ];
  }
  return [
    build(0b10, rm, said('modDisplacement16'), rmSaid),
    { kind: 'displacement', bytes: word(displacement), ...said('displacement16') }
  ];
}

/** Where an instruction sits, so that jumps can measure the distance to their target. */
export interface Placement {
  offset: number;
  /** Bytes before the fields `encodeBody` returns (a prefix). */
  lead: number;
  offsetOf: (line: number) => number;
  /** JMP only: whether it needs the 16-bit form because its target is too far for 8 bits. */
  near: boolean;
}

export function relative(
  place: Placement,
  target: number,
  size: Size,
  opcodeBytes: number
): EncodedField {
  const next = place.offset + place.lead + opcodeBytes + size / 8;
  const destination = place.offsetOf(target);
  const distance = destination - next;
  const field: EncodedField = {
    kind: 'relative',
    bytes: size === 8 ? [distance & 0xff] : word(distance),
    ...said('distance', {
      label: formatLabel(target),
      destination: formatHex(destination, 16),
      next: formatHex(next, 16),
      distance: distance < 0 ? `−${-distance}` : `+${distance}`
    })
  };
  if (size === 8 && (distance < -128 || distance > 127)) {
    const tooFar = said('tooFar', { label: formatLabel(target), distance });
    field.problem = tooFar.note;
    field.problemSay = tooFar.say;
  }
  return field;
}

/*
 * Operand narrowing. `encodeAt` only encodes valid instructions, so a mismatch here is a bug in
 * this file, not bad input: it throws instead of producing wrong bytes.
 */
function wrongOperand(expected: string, operand: Operand | undefined): never {
  throw new Error(`Expected ${expected}, got ${operand ? formatOperand(operand) : 'nothing'}`);
}

function asReg(operand: Operand | undefined): Reg {
  return operand?.type === 'reg' ? operand : wrongOperand('a register', operand);
}

export function asMem(operand: Operand | undefined): Mem {
  return operand?.type === 'mem' ? operand : wrongOperand('a memory operand', operand);
}

export function asRm(operand: Operand | undefined): Reg | Mem {
  return operand?.type === 'reg' || operand?.type === 'mem'
    ? operand
    : wrongOperand('a register or memory operand', operand);
}

export function asTarget(operand: Operand | undefined): number {
  return operand?.type === 'label' ? operand.target : wrongOperand('a label', operand);
}

/** The value of an immediate, or of a label: the byte offset of its line. */
export function numericValue(operand: Operand | undefined, place: Placement): number {
  if (operand?.type === 'imm') return operand.value;
  if (operand?.type === 'label') return place.offsetOf(operand.target);
  return wrongOperand('an immediate or a label', operand);
}

export function isAccumulator(operand: Operand | undefined): operand is Reg {
  return operand?.type === 'reg' && (operand.name === 'al' || operand.name === 'ax');
}

export function isDirect(operand: Operand | undefined): operand is Mem {
  return operand?.type === 'mem' && operand.base === null;
}

/** Everything the encoders need to know about the instruction being encoded. */
export interface Context {
  mnemonic: Mnemonic;
  first: Operand | undefined;
  second: Operand | undefined;
  size: Size;
  /** The `w` bit of most opcodes: 1 for 16-bit operands. */
  w: number;
  name: string;
  place: Placement;
}

/** Encodes the instructions it knows, and returns null for the others. */
export type Encoder = (c: Context) => EncodedField[] | null;

/** `opcode r/m, r` and its mirror image differ only in which operand ModR/M calls r/m. */
export function registerAndRm(c: Context, base: number, mirrored: number): EncodedField[] {
  const { first, second, size, w, name } = c;
  if (first?.type === 'reg' && second?.type === 'mem') {
    return [
      opcode(mirrored | w, said('registerFromRm', { name, size })),
      ...modRm(registerField(first), second)
    ];
  }
  return [
    opcode(base | w, said('rmFromRegister', { name, size })),
    ...modRm(registerField(asReg(second)), asRm(first))
  ];
}
