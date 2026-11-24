import { flagValues, hasCircuit } from './aluLink';
import {
  solveControl,
  type ControlLink,
  type ControlMemory,
  type ControlSolution,
  type WordField
} from './controlLink';
import { solve } from './logic/alu';
import type { Bit } from './logic/gates';
import type { PcRequest } from './logic/programCounter';
import { u32 } from './rv32/bits';
import { wordLayout } from './rv32/disassemble';
import { encodeAt, type EncodedField, type FieldName } from './rv32/encode';
import type { ExecutionRecord } from './rv32/execute';
import { immediateOf } from './rv32/immediate';
import { addressOfLine, INSTRUCTION_SIZE, readRegister } from './rv32/state';
import { BRANCH_TAKEN, rv32AluLink } from './rv32AluLink';
import { IMMEDIATE_LINES, RV32_CONTROL } from './rv32Control';

/** The fields the decoders tell instructions apart by; the rest only name registers and values. */
const DECODED: FieldName[] = ['opcode', 'funct3', 'funct7'];

const asWordFields = (fields: readonly EncodedField[]): WordField[] =>
  fields.map(({ name, label, high, low, note }) => ({
    label,
    high,
    low,
    note,
    decoded: DECODED.includes(name)
  }));

/** The fields of a word nobody ran, when it is an instruction of RV32IM. */
export function rv32WordFields(word: number): WordField[] | null {
  const fields = wordLayout(word);
  return fields && asWordFields(fields);
}

const NOT_FETCHED =
  'This instruction was run by itself, not fetched from the program, so PC stays where it is unless the instruction jumps.';

/** The immediate of the word, laid out as the decoder's lines say, or 0 when it has none. */
export function controlImmediate(word: number, { main }: ControlSolution): number {
  const line = Object.keys(IMMEDIATE_LINES).find((id) => main.signals[id] === 1);
  return line ? immediateOf(word, IMMEDIATE_LINES[line]) : 0;
}

/** What the ALU's circuit says of the instruction: whether a branch is taken, and its result. */
function fromAlu(record: ExecutionRecord): { taken: Bit; result: number } {
  const link = rv32AluLink(record);
  if (!hasCircuit(link)) return { taken: 0, result: 0 };
  const solution = solve(link.request);
  return { taken: flagValues(link, solution)[BRANCH_TAKEN] ?? 0, result: solution.result };
}

function pcRequest(record: ExecutionRecord, word: number, here: number): PcRequest {
  const solution = solveControl(RV32_CONTROL, word);
  const { branch, jump, jumpRegister } = solution.main.signals;
  const alu = branch || jumpRegister ? fromAlu(record) : { taken: 0 as Bit, result: 0 };
  return {
    width: 32,
    held: here,
    step: INSTRUCTION_SIZE,
    offset: controlImmediate(word, solution),
    // JALR's target is the ALU's sum with its lowest bit tied to 0.
    computed: u32(alu.result & ~1),
    fetched: record.line === null ? 0 : 1,
    branch,
    taken: alu.taken,
    jump,
    jumpComputed: jumpRegister
  };
}

/**
 * The control unit behind an executed RISC-V instruction: its word, the decoders and PC, with the
 * registers and the `memory` the instruction found.
 */
export function rv32ControlLink(record: ExecutionRecord, memory: ControlMemory): ControlLink {
  const { instruction, line, before } = record;
  const here = line === null ? before.registers.pc : addressOfLine(line);
  const { word, fields, problem } = encodeAt(instruction, here);
  return {
    word,
    width: 32,
    fields: asWordFields(fields),
    shape: RV32_CONTROL,
    pc: problem ? null : pcRequest(record, word, here),
    pcNote: problem ?? (line === null ? NOT_FETCHED : null),
    context: {
      registers: Array.from({ length: 32 }, (_, index) => readRegister(before, index)),
      here,
      fetched: line === null ? 0 : 1,
      memory
    }
  };
}
