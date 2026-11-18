import { formatInstruction, instructionSize, isValid, type Instruction } from './instructions';
import type { Context, EncodedField, Placement } from './encodingFields';
import { ENCODERS } from './instructionEncoders';

/**
 * The machine code an 8086 assembler would produce for an instruction, split into the fields
 * the CPU decodes. This is for showing only: the playground still runs instructions as data,
 * with IP counting program lines rather than these bytes.
 */
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

const PREFIX_BYTE = { rep: 0xf3, repe: 0xf3, repne: 0xf2 } as const;

function encodeBody(instruction: Instruction, place: Placement): EncodedField[] {
  const { mnemonic, operands } = instruction;
  const size = instructionSize(instruction) ?? 16;
  const context: Context = {
    mnemonic,
    first: operands[0],
    second: operands[1],
    size,
    w: size === 16 ? 1 : 0,
    name: mnemonic.toUpperCase(),
    place
  };
  for (const encoder of ENCODERS) {
    const fields = encoder(context);
    if (fields) return fields;
  }
  throw new Error(`No encoding for ${formatInstruction(instruction)}`);
}

function encodeAt(instruction: Instruction, place: Omit<Placement, 'lead'>): Encoding {
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
  const fields = [...prefix, ...encodeBody(instruction, { ...place, lead: prefix.length })];
  return {
    fields,
    bytes: fields.flatMap((field) => field.bytes),
    problem: fields.find((field) => field.problem)?.problem ?? null
  };
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
