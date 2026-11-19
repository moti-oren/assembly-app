import { formatLabel, type Program } from '../shared/program';
import {
  formatInstruction,
  getSpec,
  modeOfInstruction,
  opcodeOf,
  type Instruction
} from './instructions';
import { addressOfLine, codeEnd, instructionSize, lineAddresses } from './layout';
import { hex, MODE_NAMES, type Mode, type Operand } from './operands';
import { CODE_BASE } from './state';

/**
 * The machine code of 6502 instructions: one opcode byte, which stands for the mnemonic and the
 * addressing mode together, then 0 to 2 operand bytes, low byte first.
 */
export type FieldKind = 'opcode' | 'value' | 'address' | 'low' | 'high' | 'offset' | 'signature';

export interface EncodedField {
  kind: FieldKind;
  bytes: number[];
  note: string;
}

export interface Encoding {
  bytes: number[];
  fields: EncodedField[];
  mode: Mode;
  /** The cycles it takes, as the data sheet gives them: `4`, `4 (+1 across a page)`. */
  cycles: string;
  /** Set when it cannot be encoded as written, e.g. a branch out of range. */
  problem: string | null;
}

export interface AssembledLine {
  address: number;
  encoding: Encoding;
}

function cyclesText(instruction: Instruction): string {
  const { cycles, pageCross } = opcodeOf(instruction)!;
  if (getSpec(instruction.mnemonic).category === 'branch') {
    return `${cycles} (+1 if taken, +1 more across a page)`;
  }
  return pageCross ? `${cycles} (+1 across a page)` : String(cycles);
}

/** A 16-bit value is stored low byte first: that is what "little-endian" means. */
function word(value: number, of: string): EncodedField[] {
  return [
    { kind: 'low', bytes: [value & 0xff], note: `Low byte of ${of}` },
    { kind: 'high', bytes: [(value >> 8) & 0xff], note: `High byte of ${of}` }
  ];
}

function operandFields(
  operand: Operand,
  mode: Mode,
  program: Program<Instruction>,
  next: number
): { fields: EncodedField[]; problem: string | null } {
  switch (operand.type) {
    case 'acc':
      return { fields: [], problem: null };
    case 'imm':
      return {
        fields: [{ kind: 'value', bytes: [operand.value & 0xff], note: 'The value itself' }],
        problem: null
      };
    case 'zp':
      return {
        fields: [
          {
            kind: 'address',
            bytes: [operand.address],
            note: `The zero-page address${operand.index ? `, before ${operand.index.toUpperCase()} is added` : ''}`
          }
        ],
        problem: null
      };
    case 'izx':
    case 'izy':
      return {
        fields: [
          {
            kind: 'address',
            bytes: [operand.address],
            note: 'Where in the zero page the pointer is'
          }
        ],
        problem: null
      };
    case 'abs':
      return {
        fields: word(
          operand.address,
          `the address${operand.index ? `, before ${operand.index.toUpperCase()} is added` : ''}`
        ),
        problem: null
      };
    case 'ind':
      return { fields: word(operand.address, 'where the target address is stored'), problem: null };
    case 'label': {
      const target = addressOfLine(program, operand.target);
      if (mode === 'abs')
        return {
          fields: word(target, `${formatLabel(operand.target)}'s address, $${hex(target, 4)}`),
          problem: null
        };
      const distance = target - next;
      const problem =
        distance < -128 || distance > 127
          ? `Out of range: a branch reaches only 128 bytes back or 127 ahead, and ${formatLabel(operand.target)} is ${distance} away`
          : null;
      const note = `How far to branch from the next instruction at $${hex(next, 4)}: ${distance < 0 ? `−${-distance}` : `+${distance}`}`;
      return { fields: [{ kind: 'offset', bytes: [distance & 0xff], note }], problem };
    }
  }
}

function encodeAt(
  instruction: Instruction,
  address: number,
  program: Program<Instruction>
): Encoding {
  const mode = modeOfInstruction(instruction);
  const opcode = opcodeOf(instruction);
  if (!opcode) throw new Error(`No opcode for ${formatInstruction(instruction)}`);
  const name = instruction.mnemonic.toUpperCase();
  const fields: EncodedField[] = [
    {
      kind: 'opcode',
      bytes: [opcode.opcode],
      note: `${name}, ${MODE_NAMES[mode]}: one byte for both`
    }
  ];
  const next = address + instructionSize(instruction);
  const [operand] = instruction.operands;
  let problem: string | null = null;
  if (operand) {
    const operandPart = operandFields(operand, mode, program, next);
    fields.push(...operandPart.fields);
    problem = operandPart.problem;
  }
  if (instruction.mnemonic === 'brk') {
    fields.push({
      kind: 'signature',
      bytes: [0],
      note: 'Signature byte: BRK skips it, so the return lands after it'
    });
  }
  return {
    bytes: fields.flatMap((field) => field.bytes),
    fields,
    mode,
    cycles: cyclesText(instruction),
    problem
  };
}

/** Encodes a whole program, each line at its address from $0600 up. */
export function assemble(program: Program<Instruction>): { lines: AssembledLine[]; size: number } {
  const addresses = lineAddresses(program);
  const lines = program.map((instruction, line) => ({
    address: addresses[line],
    encoding: encodeAt(instruction, addresses[line], program)
  }));
  return { lines, size: codeEnd(program) - CODE_BASE };
}

/** Encodes one instruction as if it were the next line added at the end of `program`. */
export function encode(
  instruction: Instruction,
  program: Program<Instruction> = []
): AssembledLine {
  const address = codeEnd(program);
  return { address, encoding: encodeAt(instruction, address, [...program, instruction]) };
}

/** The byte of the program's machine code at `address`, which must be inside the code. */
export function codeByte(program: Program<Instruction>, address: number): number {
  const addresses = lineAddresses(program);
  let line = 0;
  while (addresses[line + 1] <= address) line++;
  return encodeAt(program[line], addresses[line], program).bytes[address - addresses[line]];
}
