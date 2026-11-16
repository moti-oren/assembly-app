import {
  instructionSize,
  isValid,
  formatInstruction,
  type Instruction,
  type Mnemonic
} from './instructions';
import { formatHex, toSigned, truncate, type Size } from './numbers';
import { formatLabel, type MemoryBase, type Operand } from './operands';
import { isSegmentRegister, type RegisterName } from './registers';

/**
 * The machine code an 8086 assembler would produce for an instruction, split into the fields
 * the CPU decodes. This is for showing only: the playground still runs instructions as data,
 * with IP counting program lines rather than these bytes.
 */
export type FieldKind = 'prefix' | 'opcode' | 'modrm' | 'displacement' | 'immediate' | 'relative';

/** The three bit fields of a ModR/M byte, each with what its value selects. */
export interface ModRm {
  mod: number;
  reg: number;
  rm: number;
  modNote: string;
  regNote: string;
  rmNote: string;
}

export interface EncodedField {
  kind: FieldKind;
  bytes: number[];
  note: string;
  modrm?: ModRm;
}

export interface Encoding {
  fields: EncodedField[];
  bytes: number[];
  /** Set when the 8086 cannot encode the instruction as written, e.g. a jump out of range. */
  problem: string | null;
}

export interface AssembledLine {
  /** Where the instruction starts, in bytes from the start of the program. */
  offset: number;
  encoding: Encoding;
}

type Reg = Extract<Operand, { type: 'reg' }>;
type Mem = Extract<Operand, { type: 'mem' }>;

/** Register numbers as the 8086 encodes them; the same 3 bits mean different registers by size. */
const WORD_NUMBERS = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
const BYTE_NUMBERS = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
const SEGMENT_NUMBERS = ['es', 'cs', 'ss', 'ds'];

function registerNumber(name: RegisterName): number {
  for (const table of [WORD_NUMBERS, BYTE_NUMBERS, SEGMENT_NUMBERS]) {
    const index = table.indexOf(name);
    if (index >= 0) return index;
  }
  throw new Error(`No register number for ${name}`);
}

/** r/m values of the addressing modes the playground has: one register inside the brackets. */
const BASE_RM: Record<MemoryBase, number> = { si: 0b100, di: 0b101, bp: 0b110, bx: 0b111 };
const DIRECT_RM = 0b110;

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

const PREFIX_BYTE = { rep: 0xf3, repe: 0xf3, repne: 0xf2 } as const;

const bits = (value: number, width: number): string => value.toString(2).padStart(width, '0');
const hexByte = (value: number): string => formatHex(value, 8);
const word = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
const upper = (operand: Reg): string => operand.name.toUpperCase();
/** True when a 16-bit value is a sign-extended byte, so one byte is enough to store it. */
const fitsSignedByte = (value: number): boolean => {
  const signed = toSigned(value, 16);
  return signed >= -128 && signed <= 127;
};

function opcode(byte: number, note: string): EncodedField {
  return { kind: 'opcode', bytes: [byte], note };
}

function immediate(value: number, size: Size, note: string): EncodedField {
  const bytes = size === 8 ? [value & 0xff] : word(value);
  return { kind: 'immediate', bytes, note };
}

/** What goes in the `reg` field: a register, or a number that picks one operation of a group. */
interface RegField {
  number: number;
  note: string;
}

function registerField(operand: Reg): RegField {
  const number = registerNumber(operand.name);
  return { number, note: `${bits(number, 3)} = ${upper(operand)}` };
}

function extension(number: number, name: string): RegField {
  return {
    number,
    note: `${bits(number, 3)} = /${number}: picks ${name} from this opcode's group`
  };
}

/** The ModR/M byte for `reg` and a register or memory operand, plus the displacement it calls for. */
function modRm(reg: RegField, operand: Reg | Mem): EncodedField[] {
  const build = (mod: number, rm: number, modNote: string, rmNote: string): EncodedField => ({
    kind: 'modrm',
    bytes: [(mod << 6) | (reg.number << 3) | rm],
    note: 'ModR/M: which register and which register or memory location the opcode works on',
    modrm: { mod, reg: reg.number, rm, modNote, regNote: reg.note, rmNote }
  });

  if (operand.type === 'reg') {
    const rm = registerNumber(operand.name);
    return [build(0b11, rm, '11: r/m is a register', `${bits(rm, 3)} = ${upper(operand)}`)];
  }

  const displacement = truncate(operand.displacement, 16);
  if (operand.base === null) {
    return [
      build(0b00, DIRECT_RM, '00 with r/m 110: a direct address follows', '110 = direct address'),
      {
        kind: 'displacement',
        bytes: word(displacement),
        note: 'The 16-bit address, low byte first'
      }
    ];
  }

  const rm = BASE_RM[operand.base];
  const rmNote = `${bits(rm, 3)} = [${operand.base.toUpperCase()}]`;
  // [BP] has no form without a displacement: that slot (mod 00, r/m 110) is the direct address.
  if (displacement === 0 && operand.base !== 'bp') {
    return [build(0b00, rm, '00: memory, no displacement', rmNote)];
  }
  if (fitsSignedByte(displacement)) {
    const note =
      displacement === 0
        ? 'A zero displacement: [BP] cannot be encoded without one'
        : 'The 8-bit displacement, sign-extended and added to the register';
    return [
      build(0b01, rm, '01: memory, an 8-bit displacement follows', rmNote),
      { kind: 'displacement', bytes: [displacement & 0xff], note }
    ];
  }
  return [
    build(0b10, rm, '10: memory, a 16-bit displacement follows', rmNote),
    {
      kind: 'displacement',
      bytes: word(displacement),
      note: 'The 16-bit displacement, low byte first, added to the register'
    }
  ];
}

/** Where an instruction sits, so that jumps can measure the distance to their target. */
interface Placement {
  offset: number;
  /** Bytes before the fields `encodeBody` returns (a prefix). */
  lead: number;
  offsetOf: (line: number) => number;
  /** JMP only: whether it needs the 16-bit form because its target is too far for 8 bits. */
  near: boolean;
  problem: string | null;
}

function relative(place: Placement, target: number, size: Size, opcodeBytes: number): EncodedField {
  const next = place.offset + place.lead + opcodeBytes + size / 8;
  const destination = place.offsetOf(target);
  const distance = destination - next;
  if (size === 8 && (distance < -128 || distance > 127)) {
    place.problem = `Out of range: this jump reaches only −128 to +127 bytes, and ${formatLabel(target)} is ${distance} away`;
  }
  const sum = `${formatLabel(target)} is at ${formatHex(destination, 16)}h and the next instruction at ${formatHex(next, 16)}h`;
  return {
    kind: 'relative',
    bytes: size === 8 ? [distance & 0xff] : word(distance),
    note: `The distance to jump, counted from the next instruction: ${sum}, so ${distance < 0 ? `−${-distance}` : `+${distance}`}`
  };
}

function encodeBody(instruction: Instruction, place: Placement): EncodedField[] {
  const { mnemonic, operands } = instruction;
  const [first, second] = operands;
  const size = instructionSize(instruction) ?? 16;
  const w = size === 16 ? 1 : 0;
  const name = mnemonic.toUpperCase();
  const isAccumulator = (operand: Operand | undefined): operand is Reg =>
    operand?.type === 'reg' && (operand.name === 'al' || operand.name === 'ax');
  /** The value of an immediate, or of a label: the byte offset of its line. */
  const valueOf = (operand: Operand): number =>
    operand.type === 'label'
      ? place.offsetOf(operand.target)
      : (operand as { value: number }).value;
  /** `opcode r/m, r` and its mirror image differ only in which operand ModR/M calls r/m. */
  const registerAndRm = (base: number, mirrored: number): EncodedField[] => {
    if (first.type === 'reg' && second.type === 'mem') {
      return [
        opcode(mirrored | w, `${name} r${size}, r/m${size}`),
        ...modRm(registerField(first), second)
      ];
    }
    return [
      opcode(base | w, `${name} r/m${size}, r${size}`),
      ...modRm(registerField(second as Reg), first as Reg | Mem)
    ];
  };

  const single = SINGLE_BYTE[mnemonic];
  if (single !== undefined) return [opcode(single, `${name}: the whole instruction is this byte`)];

  const shortJump = SHORT_JUMP[mnemonic];
  if (shortJump !== undefined && first.type === 'label') {
    return [
      opcode(shortJump, `${name} with an 8-bit distance`),
      relative(place, first.target, 8, 1)
    ];
  }

  const alu = ALU_NUMBER[mnemonic];
  if (alu !== undefined) {
    if (second.type !== 'imm') return registerAndRm(alu << 3, (alu << 3) | 0b10);
    const value = truncate(second.value, size);
    if (size === 16 && fitsSignedByte(value)) {
      return [
        opcode(0x83, 'Group: r/m16 with an 8-bit immediate that is sign-extended to 16 bits'),
        ...modRm(extension(alu, name), first as Reg | Mem),
        immediate(value, 8, 'The immediate, stored in one byte and sign-extended')
      ];
    }
    if (isAccumulator(first)) {
      return [
        opcode(
          (alu << 3) | 0b100 | w,
          `${name} ${upper(first)}, imm${size}: a short form with no ModR/M`
        ),
        immediate(value, size, 'The immediate, low byte first')
      ];
    }
    return [
      opcode(0x80 | w, `Group: r/m${size} with a ${size}-bit immediate`),
      ...modRm(extension(alu, name), first as Reg | Mem),
      immediate(value, size, 'The immediate, low byte first')
    ];
  }

  const unary = UNARY_NUMBER[mnemonic];
  if (unary !== undefined) {
    return [
      opcode(0xf6 | w, `Group: one-operand arithmetic on r/m${size}`),
      ...modRm(extension(unary, name), first as Reg | Mem)
    ];
  }

  const shift = SHIFT_NUMBER[mnemonic];
  if (shift !== undefined) {
    const byCl = second.type === 'reg';
    return [
      opcode(0xd0 | (byCl ? 0b10 : 0) | w, `Group: shift r/m${size} by ${byCl ? 'CL' : '1'}`),
      ...modRm(extension(shift, name), first as Reg | Mem)
    ];
  }

  switch (mnemonic) {
    case 'mov': {
      if (first.type === 'reg' && isSegmentRegister(first.name)) {
        return [
          opcode(0x8e, 'MOV sreg, r/m16'),
          ...modRm(registerField(first), second as Reg | Mem)
        ];
      }
      if (second.type === 'reg' && isSegmentRegister(second.name)) {
        return [
          opcode(0x8c, 'MOV r/m16, sreg'),
          ...modRm(registerField(second), first as Reg | Mem)
        ];
      }
      if (second.type === 'imm' || second.type === 'label') {
        const note =
          second.type === 'label'
            ? `The offset of ${formatLabel(second.target)} in the code, low byte first`
            : 'The immediate, low byte first';
        const value = truncate(valueOf(second), size);
        if (first.type === 'reg') {
          const number = registerNumber(first.name);
          return [
            opcode(
              0xb0 | (w << 3) | number,
              `MOV r${size}, imm${size}: ${hexByte(0xb0 | (w << 3))} + the register number (${upper(first)} = ${number})`
            ),
            immediate(value, size, note)
          ];
        }
        return [
          opcode(0xc6 | w, `MOV r/m${size}, imm${size}`),
          ...modRm(extension(0, 'MOV'), first as Mem),
          immediate(value, size, note)
        ];
      }
      const direct = (operand: Operand): operand is Mem =>
        operand.type === 'mem' && operand.base === null;
      const address = (operand: Mem): EncodedField => ({
        kind: 'displacement',
        bytes: word(truncate(operand.displacement, 16)),
        note: 'The 16-bit address, low byte first'
      });
      if (isAccumulator(first) && direct(second)) {
        return [
          opcode(0xa0 | w, `MOV ${upper(first)}, [address]: a short form with no ModR/M`),
          address(second)
        ];
      }
      if (direct(first) && isAccumulator(second)) {
        return [
          opcode(0xa2 | w, `MOV [address], ${upper(second)}: a short form with no ModR/M`),
          address(first)
        ];
      }
      return registerAndRm(0x88, 0x8a);
    }
    case 'xchg': {
      const other = isAccumulator(first) ? second : isAccumulator(second) ? first : null;
      if (size === 16 && other?.type === 'reg') {
        const number = registerNumber(other.name);
        return [
          opcode(
            0x90 | number,
            `XCHG AX, r16: 90 + the register number (${upper(other)} = ${number})`
          )
        ];
      }
      // Swapping is symmetric, so either register could go in `reg`; assemblers put the first there.
      if (first.type === 'reg' && second.type === 'reg') {
        return [
          opcode(0x86 | w, `XCHG r${size}, r/m${size}`),
          ...modRm(registerField(first), second)
        ];
      }
      return registerAndRm(0x86, 0x86);
    }
    case 'test': {
      if (second.type !== 'imm') return registerAndRm(0x84, 0x84);
      const value = truncate(second.value, size);
      if (isAccumulator(first)) {
        return [
          opcode(0xa8 | w, `TEST ${upper(first)}, imm${size}: a short form with no ModR/M`),
          immediate(value, size, 'The immediate, low byte first')
        ];
      }
      return [
        opcode(0xf6 | w, `Group: one-operand arithmetic on r/m${size}`),
        ...modRm(extension(0, 'TEST'), first as Reg | Mem),
        immediate(value, size, 'The immediate, low byte first')
      ];
    }
    case 'push':
    case 'pop': {
      const pushing = mnemonic === 'push';
      if (first.type === 'reg') {
        const number = registerNumber(first.name);
        if (isSegmentRegister(first.name)) {
          return [
            opcode(
              (pushing ? 0x06 : 0x07) | (number << 3),
              `${name} sreg: the segment register number (${upper(first)} = ${number}) sits in bits 3 and 4`
            )
          ];
        }
        const base = pushing ? 0x50 : 0x58;
        return [
          opcode(
            base | number,
            `${name} r16: ${hexByte(base)} + the register number (${upper(first)} = ${number})`
          )
        ];
      }
      return pushing
        ? [
            opcode(0xff, 'Group: one-operand instructions on r/m16'),
            ...modRm(extension(6, 'PUSH'), first as Mem)
          ]
        : [opcode(0x8f, 'POP r/m16'), ...modRm(extension(0, 'POP'), first as Mem)];
    }
    case 'inc':
    case 'dec': {
      const number = mnemonic === 'inc' ? 0 : 1;
      if (first.type === 'reg' && size === 16) {
        const base = 0x40 | (number << 3);
        const register = registerNumber(first.name);
        return [
          opcode(
            base | register,
            `${name} r16: ${hexByte(base)} + the register number (${upper(first)} = ${register})`
          )
        ];
      }
      return [
        opcode(0xfe | w, `Group: one-operand instructions on r/m${size}`),
        ...modRm(extension(number, name), first as Reg | Mem)
      ];
    }
    case 'jmp': {
      const target = (first as Extract<Operand, { type: 'label' }>).target;
      return place.near
        ? [opcode(0xe9, 'JMP with a 16-bit distance (near)'), relative(place, target, 16, 1)]
        : [opcode(0xeb, 'JMP with an 8-bit distance (short)'), relative(place, target, 8, 1)];
    }
    case 'call': {
      const target = (first as Extract<Operand, { type: 'label' }>).target;
      return [opcode(0xe8, 'CALL with a 16-bit distance'), relative(place, target, 16, 1)];
    }
    case 'in':
    case 'out': {
      const port = mnemonic === 'in' ? second : first;
      const base = mnemonic === 'in' ? 0xe4 : 0xe6;
      if (port.type === 'reg') {
        return [opcode(base | 0b1000 | w, `${name} through the port in DX, ${size} bits`)];
      }
      return [
        opcode(base | w, `${name} through a fixed port, ${size} bits`),
        immediate(truncate(valueOf(port), 8), 8, 'The port number')
      ];
    }
    case 'int': {
      const type = valueOf(first) & 0xff;
      return type === 3
        ? [opcode(0xcc, 'INT 3: its own one-byte opcode, made for breakpoints')]
        : [opcode(0xcd, 'INT'), immediate(type, 8, 'The interrupt number')];
    }
    default:
      throw new Error(`No encoding for ${formatInstruction(instruction)}`);
  }
}

function encodeAt(instruction: Instruction, place: Omit<Placement, 'lead' | 'problem'>): Encoding {
  if (!isValid(instruction)) {
    throw new Error(`Cannot encode an incomplete instruction: ${formatInstruction(instruction)}`);
  }
  const prefix: EncodedField[] = instruction.prefix
    ? [
        {
          kind: 'prefix',
          bytes: [PREFIX_BYTE[instruction.prefix]],
          note: `${instruction.prefix.toUpperCase()}: repeat the string instruction that follows while CX ≠ 0`
        }
      ]
    : [];
  const placement: Placement = { ...place, lead: prefix.length, problem: null };
  const fields = [...prefix, ...encodeBody(instruction, placement)];
  return { fields, bytes: fields.flatMap((field) => field.bytes), problem: placement.problem };
}

/**
 * Encodes a whole program, giving every line its byte offset. Jump distances depend on the
 * sizes of the lines between a jump and its target, so this is where they get resolved. A JMP
 * starts out short (2 bytes) and grows to near (3 bytes) only if its target is out of reach.
 */
export function assemble(program: readonly Instruction[]): {
  lines: AssembledLine[];
  size: number;
} {
  const near = program.map(() => false);
  for (;;) {
    const offsets: number[] = [];
    let size = 0;
    for (const [index, instruction] of program.entries()) {
      offsets.push(size);
      size += encodeAt(instruction, { offset: 0, offsetOf: () => 0, near: near[index] }).bytes
        .length;
    }
    // Targets past the last line (the end of the program) are just after the last byte.
    const offsetOf = (line: number): number => offsets[line] ?? size;
    const lines = program.map((instruction, index) => ({
      offset: offsets[index],
      encoding: encodeAt(instruction, { offset: offsets[index], offsetOf, near: near[index] })
    }));

    const tooFar = lines.findIndex(
      (line, index) =>
        program[index].mnemonic === 'jmp' && !near[index] && line.encoding.problem !== null
    );
    if (tooFar < 0) return { lines, size };
    near[tooFar] = true;
  }
}

/** Encodes one instruction as if it were the next line added at the end of `program`. */
export function encode(
  instruction: Instruction,
  program: readonly Instruction[] = []
): AssembledLine {
  return assemble([...program, instruction]).lines[program.length];
}
