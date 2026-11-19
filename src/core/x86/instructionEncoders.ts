import type { Mnemonic } from './instructions';
import { truncate } from '../shared/numbers';
import { formatLabel } from '../shared/program';
import { said } from './encodingTexts';
import { isSegmentRegister } from './registers';
import {
  asMem,
  asRm,
  asTarget,
  type EncodedField,
  type Encoder,
  extension,
  fitsSignedByte,
  hexByte,
  immediate,
  isAccumulator,
  isDirect,
  type Mem,
  modRm,
  numericValue,
  opcode,
  registerAndRm,
  registerField,
  registerNumber,
  relative,
  upper,
  word
} from './encodingFields';

/** The instructions that share the classic "ALU" opcode layout; the number picks the operation. */
const ALU_NUMBER: Partial<Record<Mnemonic, number>> = {
  add: 0,
  or: 1,
  adc: 2,
  sbb: 3,
  and: 4,
  sub: 5,
  xor: 6,
  cmp: 7
};

/** One-operand group behind opcodes F6/F7. */
const UNARY_NUMBER: Partial<Record<Mnemonic, number>> = {
  not: 2,
  neg: 3,
  mul: 4,
  imul: 5,
  div: 6,
  idiv: 7
};

/** Shift group behind opcodes D0 to D3. */
const SHIFT_NUMBER: Partial<Record<Mnemonic, number>> = {
  rol: 0,
  ror: 1,
  rcl: 2,
  rcr: 3,
  shl: 4,
  shr: 5,
  sar: 7
};

/** Jumps that take an 8-bit displacement and nothing else. Synonyms share an opcode. */
const SHORT_JUMP: Partial<Record<Mnemonic, number>> = {
  jo: 0x70,
  jno: 0x71,
  jb: 0x72,
  jc: 0x72,
  jae: 0x73,
  jnc: 0x73,
  je: 0x74,
  jz: 0x74,
  jne: 0x75,
  jnz: 0x75,
  jbe: 0x76,
  ja: 0x77,
  js: 0x78,
  jns: 0x79,
  jp: 0x7a,
  jnp: 0x7b,
  jl: 0x7c,
  jge: 0x7d,
  jle: 0x7e,
  jg: 0x7f,
  loopne: 0xe0,
  loope: 0xe1,
  loop: 0xe2,
  jcxz: 0xe3
};

/** Instructions that are a single opcode byte with nothing after it. */
const SINGLE_BYTE: Partial<Record<Mnemonic, number>> = {
  ret: 0xc3,
  movsb: 0xa4,
  movsw: 0xa5,
  cmpsb: 0xa6,
  cmpsw: 0xa7,
  stosb: 0xaa,
  stosw: 0xab,
  lodsb: 0xac,
  lodsw: 0xad,
  scasb: 0xae,
  scasw: 0xaf,
  into: 0xce,
  iret: 0xcf,
  pushf: 0x9c,
  popf: 0x9d,
  clc: 0xf8,
  stc: 0xf9,
  cmc: 0xf5,
  cld: 0xfc,
  std: 0xfd,
  cli: 0xfa,
  sti: 0xfb,
  nop: 0x90
};

const encodeSingleByte: Encoder = ({ mnemonic, name }) => {
  const byte = SINGLE_BYTE[mnemonic];
  return byte === undefined ? null : [opcode(byte, said('wholeByte', { name }))];
};

const encodeShortJump: Encoder = ({ mnemonic, first, name, place }) => {
  const code = SHORT_JUMP[mnemonic];
  if (code === undefined) return null;
  return [opcode(code, said('shortDistance', { name })), relative(place, asTarget(first), 8, 1)];
};

const encodeAlu: Encoder = (c) => {
  const alu = ALU_NUMBER[c.mnemonic];
  if (alu === undefined) return null;
  const { first, second, size, w, name } = c;
  if (second?.type !== 'imm') return registerAndRm(c, alu << 3, (alu << 3) | 0b10);
  const value = truncate(second.value, size);
  if (size === 16 && fitsSignedByte(value)) {
    return [
      opcode(0x83, said('groupSignExtended')),
      ...modRm(extension(alu, name), asRm(first)),
      immediate(value, 8, said('immediateSignExtended'))
    ];
  }
  if (isAccumulator(first)) {
    return [
      opcode(
        (alu << 3) | 0b100 | w,
        said('accumulatorImmediate', { name, register: upper(first), size })
      ),
      immediate(value, size, said('immediateLowFirst'))
    ];
  }
  return [
    opcode(0x80 | w, said('groupImmediate', { size })),
    ...modRm(extension(alu, name), asRm(first)),
    immediate(value, size, said('immediateLowFirst'))
  ];
};

const encodeUnary: Encoder = ({ mnemonic, first, size, w, name }) => {
  const unary = UNARY_NUMBER[mnemonic];
  if (unary === undefined) return null;
  return [
    opcode(0xf6 | w, said('groupArithmetic', { size })),
    ...modRm(extension(unary, name), asRm(first))
  ];
};

const encodeShift: Encoder = ({ mnemonic, first, second, size, w, name }) => {
  const shift = SHIFT_NUMBER[mnemonic];
  if (shift === undefined) return null;
  const byCl = second?.type === 'reg';
  return [
    opcode(0xd0 | (byCl ? 0b10 : 0) | w, said('groupShift', { size, count: byCl ? 'CL' : '1' })),
    ...modRm(extension(shift, name), asRm(first))
  ];
};

/** The 16-bit address of a direct memory operand, for the forms that carry no ModR/M. */
function directAddress(operand: Mem): EncodedField {
  return {
    kind: 'displacement',
    bytes: word(truncate(operand.displacement, 16)),
    ...said('addressLowFirst')
  };
}

const encodeMov: Encoder = (c) => {
  const { first, second, size, w, place } = c;
  if (first?.type === 'reg' && isSegmentRegister(first.name)) {
    return [opcode(0x8e, said('movSegmentFrom')), ...modRm(registerField(first), asRm(second))];
  }
  if (second?.type === 'reg' && isSegmentRegister(second.name)) {
    return [opcode(0x8c, said('movSegmentTo')), ...modRm(registerField(second), asRm(first))];
  }
  if (second?.type === 'imm' || second?.type === 'label') {
    const note =
      second.type === 'label'
        ? said('labelOffset', { label: formatLabel(second.target) })
        : said('immediateLowFirst');
    const value = truncate(numericValue(second, place), size);
    if (first?.type === 'reg') {
      const number = registerNumber(first.name);
      return [
        opcode(
          0xb0 | (w << 3) | number,
          said('movRegisterImmediate', {
            size,
            base: hexByte(0xb0 | (w << 3)),
            register: upper(first),
            number
          })
        ),
        immediate(value, size, note)
      ];
    }
    return [
      opcode(0xc6 | w, said('movMemoryImmediate', { size })),
      ...modRm(extension(0, 'MOV'), asMem(first)),
      immediate(value, size, note)
    ];
  }
  if (isAccumulator(first) && isDirect(second)) {
    return [
      opcode(0xa0 | w, said('movFromAddress', { register: upper(first) })),
      directAddress(second)
    ];
  }
  if (isDirect(first) && isAccumulator(second)) {
    return [
      opcode(0xa2 | w, said('movToAddress', { register: upper(second) })),
      directAddress(first)
    ];
  }
  return registerAndRm(c, 0x88, 0x8a);
};

const encodeXchg: Encoder = (c) => {
  const { first, second, size, w } = c;
  const other = isAccumulator(first) ? second : isAccumulator(second) ? first : null;
  if (size === 16 && other?.type === 'reg') {
    const number = registerNumber(other.name);
    return [opcode(0x90 | number, said('xchgAccumulator', { register: upper(other), number }))];
  }
  // Swapping is symmetric, so either register could go in `reg`; assemblers put the first there.
  if (first?.type === 'reg' && second?.type === 'reg') {
    return [opcode(0x86 | w, said('xchgMemory', { size })), ...modRm(registerField(first), second)];
  }
  return registerAndRm(c, 0x86, 0x86);
};

const encodeTest: Encoder = (c) => {
  const { first, second, size, w } = c;
  if (second?.type !== 'imm') return registerAndRm(c, 0x84, 0x84);
  const value = truncate(second.value, size);
  if (isAccumulator(first)) {
    return [
      opcode(0xa8 | w, said('testAccumulator', { register: upper(first), size })),
      immediate(value, size, said('immediateLowFirst'))
    ];
  }
  return [
    opcode(0xf6 | w, said('groupArithmetic', { size })),
    ...modRm(extension(0, 'TEST'), asRm(first)),
    immediate(value, size, said('immediateLowFirst'))
  ];
};

const encodePushPop: Encoder = ({ mnemonic, first, name }) => {
  const pushing = mnemonic === 'push';
  if (first?.type === 'reg') {
    const number = registerNumber(first.name);
    if (isSegmentRegister(first.name)) {
      return [
        opcode(
          (pushing ? 0x06 : 0x07) | (number << 3),
          said('pushPopSegment', { name, register: upper(first), number })
        )
      ];
    }
    const base = pushing ? 0x50 : 0x58;
    return [
      opcode(
        base | number,
        said('registerPlusNumber', { name, base: hexByte(base), register: upper(first), number })
      )
    ];
  }
  return pushing
    ? [opcode(0xff, said('groupOneOperand16')), ...modRm(extension(6, 'PUSH'), asMem(first))]
    : [opcode(0x8f, said('popMemory')), ...modRm(extension(0, 'POP'), asMem(first))];
};

const encodeIncDec: Encoder = ({ mnemonic, first, size, w, name }) => {
  const number = mnemonic === 'inc' ? 0 : 1;
  if (first?.type === 'reg' && size === 16) {
    const base = 0x40 | (number << 3);
    const register = registerNumber(first.name);
    return [
      opcode(
        base | register,
        said('registerPlusNumber', {
          name,
          base: hexByte(base),
          register: upper(first),
          number: register
        })
      )
    ];
  }
  return [
    opcode(0xfe | w, said('groupOneOperand', { size })),
    ...modRm(extension(number, name), asRm(first))
  ];
};

const encodeJmp: Encoder = ({ first, place }) => {
  const target = asTarget(first);
  return place.near
    ? [opcode(0xe9, said('jmpNear')), relative(place, target, 16, 1)]
    : [opcode(0xeb, said('jmpShort')), relative(place, target, 8, 1)];
};

const encodeCall: Encoder = ({ first, place }) => [
  opcode(0xe8, said('callNear')),
  relative(place, asTarget(first), 16, 1)
];

const encodeInOut: Encoder = ({ mnemonic, first, second, size, w, name, place }) => {
  const port = mnemonic === 'in' ? second : first;
  const base = mnemonic === 'in' ? 0xe4 : 0xe6;
  if (port?.type === 'reg') {
    return [opcode(base | 0b1000 | w, said('portInDx', { name, size }))];
  }
  return [
    opcode(base | w, said('portFixed', { name, size })),
    immediate(truncate(numericValue(port, place), 8), 8, said('portNumber'))
  ];
};

const encodeInt: Encoder = ({ first, place }) => {
  const type = numericValue(first, place) & 0xff;
  return type === 3
    ? [opcode(0xcc, said('int3'))]
    : [opcode(0xcd, said('intNumber')), immediate(type, 8, said('interruptNumber'))];
};

/** Instructions with an encoding of their own rather than a slot in an opcode group. */
const BY_MNEMONIC: Partial<Record<Mnemonic, Encoder>> = {
  mov: encodeMov,
  xchg: encodeXchg,
  test: encodeTest,
  push: encodePushPop,
  pop: encodePushPop,
  inc: encodeIncDec,
  dec: encodeIncDec,
  jmp: encodeJmp,
  call: encodeCall,
  in: encodeInOut,
  out: encodeInOut,
  int: encodeInt
};

/** Tried in order; the first encoder that knows the instruction encodes it. */
export const ENCODERS: readonly Encoder[] = [
  encodeSingleByte,
  encodeShortJump,
  encodeAlu,
  encodeUnary,
  encodeShift,
  (c) => BY_MNEMONIC[c.mnemonic]?.(c) ?? null
];
