import type { Said, TextParams } from '../shared/text';
import { mos6502Said, type Mos6502EncodingTextKey, type Mos6502Spoken } from './encodingTexts';
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
  /** What the field says, in English, and which sentence that is. */
  note: string;
  say: Said<Mos6502EncodingTextKey>;
}

export interface Encoding {
  bytes: number[];
  fields: EncodedField[];
  mode: Mode;
  /** The cycles it takes, as the data sheet gives them: `4`, `4 (+1 across a page)`. */
  cycles: string;
  /** The same, as a key, when it is more than a number: another language words it. */
  cyclesSay: Said<Mos6502EncodingTextKey> | null;
  /** Set when it cannot be encoded as written, e.g. a branch out of range. */
  problem: string | null;
  problemSay: Said<Mos6502EncodingTextKey> | null;
}

export interface AssembledLine {
  address: number;
  encoding: Encoding;
}

function cyclesText(instruction: Instruction): {
  text: string;
  say: Said<Mos6502EncodingTextKey> | null;
} {
  const { cycles, pageCross } = opcodeOf(instruction)!;
  if (getSpec(instruction.mnemonic).category === 'branch') {
    const spoken = mos6502Said('cyclesBranch', { cycles });
    return { text: spoken.note, say: spoken.say };
  }
  if (!pageCross) return { text: String(cycles), say: null };
  const spoken = mos6502Said('cyclesPage', { cycles });
  return { text: spoken.note, say: spoken.say };
}

/** A 16-bit value is stored low byte first: that is what "little-endian" means. */
function word(
  value: number,
  keys: { low: Mos6502EncodingTextKey; high: Mos6502EncodingTextKey },
  params: TextParams = {}
): EncodedField[] {
  return [
    { kind: 'low', bytes: [value & 0xff], ...mos6502Said(keys.low, params) },
    { kind: 'high', bytes: [(value >> 8) & 0xff], ...mos6502Said(keys.high, params) }
  ];
}

function operandFields(
  operand: Operand,
  mode: Mode,
  program: Program<Instruction>,
  next: number
): { fields: EncodedField[]; problem: Mos6502Spoken | null } {
  switch (operand.type) {
    case 'acc':
      return { fields: [], problem: null };
    case 'imm':
      return {
        fields: [{ kind: 'value', bytes: [operand.value & 0xff], ...mos6502Said('valueItself') }],
        problem: null
      };
    case 'zp':
      return {
        fields: [
          {
            kind: 'address',
            bytes: [operand.address],
            ...(operand.index
              ? mos6502Said('zeroPageIndexed', { index: operand.index.toUpperCase() })
              : mos6502Said('zeroPage'))
          }
        ],
        problem: null
      };
    case 'izx':
    case 'izy':
      return {
        fields: [{ kind: 'address', bytes: [operand.address], ...mos6502Said('pointerAddress') }],
        problem: null
      };
    case 'abs':
      return {
        fields: operand.index
          ? word(
              operand.address,
              { low: 'lowAddressIndexed', high: 'highAddressIndexed' },
              { index: operand.index.toUpperCase() }
            )
          : word(operand.address, { low: 'lowAddress', high: 'highAddress' }),
        problem: null
      };
    case 'ind':
      return {
        fields: word(operand.address, { low: 'lowStored', high: 'highStored' }),
        problem: null
      };
    case 'label': {
      const target = addressOfLine(program, operand.target);
      if (mode === 'abs')
        return {
          fields: word(
            target,
            { low: 'lowTarget', high: 'highTarget' },
            { label: formatLabel(operand.target), address: `$${hex(target, 4)}` }
          ),
          problem: null
        };
      const distance = target - next;
      const problem =
        distance < -128 || distance > 127
          ? mos6502Said('outOfRange', { label: formatLabel(operand.target), distance })
          : null;
      const spoken = mos6502Said('branchDistance', {
        next: `$${hex(next, 4)}`,
        distance: distance < 0 ? `−${-distance}` : `+${distance}`
      });
      return { fields: [{ kind: 'offset', bytes: [distance & 0xff], ...spoken }], problem };
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
      ...mos6502Said('opcode', { name, mode: MODE_NAMES[mode] })
    }
  ];
  const cycles = cyclesText(instruction);
  const next = address + instructionSize(instruction);
  const [operand] = instruction.operands;
  let problem: Mos6502Spoken | null = null;
  if (operand) {
    const operandPart = operandFields(operand, mode, program, next);
    fields.push(...operandPart.fields);
    problem = operandPart.problem;
  }
  if (instruction.mnemonic === 'brk') {
    fields.push({ kind: 'signature', bytes: [0], ...mos6502Said('signature') });
  }
  return {
    bytes: fields.flatMap((field) => field.bytes),
    fields,
    mode,
    cycles: cycles.text,
    cyclesSay: cycles.say,
    problem: problem?.note ?? null,
    problemSay: problem?.say ?? null
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
