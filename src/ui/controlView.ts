import {
  hasControl,
  type ControlLink,
  type ControlSolution,
  type ControlView,
  type WordField
} from '@/core/controlLink';
import { activeLines, activeTerms } from '@/core/logic/decoder';
import type { Faults } from '@/core/logic/fault';
import { bitOf, type Bit } from '@/core/logic/gates';
import { PC, type PcSolution } from '@/core/logic/programCounter';
import type { ClockPhase } from '@/core/logic/register';
import { disassemble, formatDisassembly } from '@/core/rv32/disassemble';
import { hexOf } from './logicView';
import type { LinkedTopic } from './topics';

/** The word the page starts from when no CPU gave it one: `add a0, a0, a1`. */
export const STARTING_WORD = 0x00b50533;

/** A control line as the page names it, with what it does when it is 1. */
interface LineText {
  label: string;
  does: string;
  /** The topic that shows the part of the CPU this line switches. */
  topic?: LinkedTopic;
}

const LINES: Record<string, LineText> = {
  regWrite: {
    label: 'RegWrite',
    does: 'rd is written when the clock rises',
    topic: 'storage'
  },
  aluSrcA: { label: 'ALUSrcA', does: 'the ALU’s first input is PC, not rs1' },
  aluSrcB: { label: 'ALUSrcB', does: 'the ALU’s second input is the immediate, not rs2' },
  aluAdd: { label: 'ALUAdd', does: 'the ALU adds whatever funct3 says: it works out an address' },
  memRead: { label: 'MemRead', does: 'memory is read at the address the ALU worked out' },
  memWrite: { label: 'MemWrite', does: 'rs2 is written to memory at that address' },
  fromMemory: { label: 'ResultMem', does: 'rd gets what memory gave, not the ALU’s result' },
  link: { label: 'ResultLink', does: 'rd gets PC + 4, the way back' },
  upper: { label: 'ResultImm', does: 'rd gets the immediate itself' },
  branch: { label: 'Branch', does: 'PC goes to the target if the comparison says so' },
  jump: { label: 'Jump', does: 'PC goes somewhere else, whatever the registers hold' },
  jumpRegister: { label: 'JumpReg', does: 'the target is the ALU’s sum, not PC + immediate' },
  immI: { label: 'ImmI', does: 'the immediate is the top 12 bits of the word' },
  immS: { label: 'ImmS', does: 'the immediate is split around rs1 and rs2' },
  immB: { label: 'ImmB', does: 'the immediate is a branch’s distance, in four pieces' },
  immU: { label: 'ImmU', does: 'the immediate is the top 20 bits, with 12 zeros under them' },
  immJ: { label: 'ImmJ', does: 'the immediate is a jump’s distance, in four pieces' },
  aluSum: { label: 'Sum', does: 'the result is the adder’s output', topic: 'logic' },
  aluSub: {
    label: 'Sub',
    does: 'the adder subtracts: B is inverted and a 1 is carried in',
    topic: 'logic'
  },
  aluAnd: { label: 'And', does: 'the result is an AND gate per bit', topic: 'logic' },
  aluOr: { label: 'Or', does: 'the result is an OR gate per bit', topic: 'logic' },
  aluXor: { label: 'Xor', does: 'the result is an XOR gate per bit', topic: 'logic' },
  aluShift: { label: 'Shift', does: 'the result is the shifter’s output', topic: 'logic' },
  shiftRight: { label: 'Right', does: 'the shifter moves the bits right, not left' },
  shiftArithmetic: { label: 'Arith', does: 'copies of the top bit come in, not zeros' },
  setLess: { label: 'Less', does: 'rd gets the one wire that says “less than”, signed' },
  setLessUnsigned: { label: 'LessU', does: 'rd gets “less than” read from the carry: unsigned' },
  mulDiv: { label: 'MulDiv', does: 'the operands go to the multiplier and divider instead' },
  readZero: { label: 'ReadZero', does: 'the branch reads the wire that says the difference is 0' },
  readLess: { label: 'ReadLess', does: 'the branch reads the signed “less than” wire' },
  readCarry: { label: 'ReadCarry', does: 'the branch reads the carry out of the subtraction' },
  invert: { label: 'Invert', does: 'the wire goes through a NOT gate first' }
};

const TERMS: Record<string, string> = {
  OP: 'OP',
  OP_IMM: 'OP-IMM',
  LOAD: 'LOAD',
  STORE: 'STORE',
  BRANCH: 'BRANCH',
  JAL: 'JAL',
  JALR: 'JALR',
  LUI: 'LUI',
  AUIPC: 'AUIPC',
  address: 'address',
  muldiv: 'M'
};

/** The name of a control line, a term or an input wire as the page shows it. */
export function controlLabel(id: string): string {
  return LINES[id]?.label ?? TERMS[id] ?? id.toUpperCase();
}

/** The bit of the word behind an input wire as a column heading, or the wire's own name. */
export function inputLabel(id: string, wires: Readonly<Record<string, number>>): string {
  return id in wires ? String(wires[id]) : controlLabel(id);
}

/** One control line in the list of what the decoders decided. */
export interface LineRow {
  id: string;
  label: string;
  on: boolean;
  does: string;
  topic: LinkedTopic | null;
}

function lineRows(ids: readonly string[], on: readonly string[]): LineRow[] {
  return ids.map((id) => ({
    id,
    label: controlLabel(id),
    on: on.includes(id),
    does: LINES[id]?.does ?? '',
    topic: LINES[id]?.topic ?? null
  }));
}

/** The lines of both decoders, those that are on first. */
export function controlLines({ main, alu }: ControlSolution): LineRow[] {
  const rows = [
    ...lineRows(
      main.shape.lines.map((line) => line.id),
      activeLines(main)
    ),
    ...lineRows(
      alu.shape.lines.map((line) => line.id),
      activeLines(alu)
    )
  ];
  return [...rows.filter((row) => row.on), ...rows.filter((row) => !row.on)];
}

/** The word and what the main decoder made of it: `0x00B50533 is OP: RegWrite, Sum`. */
export function equationText(word: number, solution: ControlSolution, faults: Faults = {}): string {
  const [kind] = activeTerms(solution.main);
  const hex = hexOf(word, 32);
  const stuck = Object.entries(faults).map(
    ([line, value]) => `${controlLabel(line)} stuck at ${value}`
  );
  // A broken line is not the instruction's: it is said apart, after what the word decodes to.
  const broken = stuck.length ? `, with ${stuck.join(' and ')}` : '';
  if (!kind) return `${hex} is no instruction the decoder knows${broken}`;
  const on = [...activeLines(solution.main), ...activeLines(solution.alu)].map(controlLabel);
  return `${hex} is ${controlLabel(kind)}: ${on.join(', ')}${broken}`;
}

/** Why the CPU's last instruction has no control unit to show, or null when it has one. */
export function unavailableText(link: ControlLink | null): string | null {
  return link && !hasControl(link)
    ? `${link.unavailable} The word on show is one to try by hand.`
    : null;
}

/** A field of the word with its bits, for the list under the word. */
export interface FieldRow extends WordField {
  range: string;
  bits: string;
}

/**
 * The fields of the word on show: the instruction's `own`, or only those the decoders read when
 * the word is no instruction, since the others depend on what it would be.
 */
export function wordFields(
  reads: readonly WordField[],
  own: readonly WordField[] | null,
  word: number
): FieldRow[] {
  const fields = own ?? reads;
  return fields.map((field) => {
    const { high, low } = field;
    const width = high - low + 1;
    return {
      ...field,
      range: high === low ? `bit ${high}` : `bits ${high}–${low}`,
      bits: ((word >>> low) & (2 ** width - 1)).toString(2).padStart(width, '0')
    };
  });
}

/** A column above the word's bits: the field its bit belongs to, named where the field starts. */
export interface FieldMark {
  bit: number;
  /** The field's name, on its leftmost bit only. */
  label: string | null;
  /** Whether the bit is the field's leftmost or rightmost, where its bracket ends. */
  start: boolean;
  end: boolean;
  decoded: boolean;
  /** How many bits the field spans, which is all the room its name has. */
  span: number;
}

/** The fields drawn as brackets over 32 bits, the top bit first, as the rows of bits are. */
export function fieldMarks(fields: readonly WordField[], width = 32): FieldMark[] {
  return Array.from({ length: width }, (_, column) => {
    const bit = width - 1 - column;
    const field = fields.find(({ high, low }) => bit <= high && bit >= low);
    return {
      bit,
      label: field && field.high === bit ? field.label : null,
      start: field?.high === bit,
      end: field?.low === bit,
      decoded: field?.decoded ?? false,
      span: field ? field.high - field.low + 1 : 0
    };
  });
}

/** A word typed in hex, with or without `0x`, or null when it is not up to eight hex digits. */
export function parseWord(text: string): number | null {
  const digits = text.replace(/[\s_]/g, '').replace(/^0x/i, '');
  return /^[0-9a-f]{1,8}$/i.test(digits) ? parseInt(digits, 16) : null;
}

/** The word read back as the instruction it encodes, or why it is none. */
export function readingText(word: number, { main }: ControlSolution): string {
  const read = disassemble(word);
  if (read) return `As assembly: ${formatDisassembly(read)}`;
  const [kind] = activeTerms(main);
  return kind
    ? `The main decoder takes this for ${controlLabel(kind)}, but no RV32IM instruction has these function bits. A real CPU checks them all and refuses the word.`
    : 'This CPU has no instruction with this opcode: it runs RV32IM without ECALL, EBREAK and FENCE.';
}

/** The word with one bit turned over. */
export function withBitFlipped(word: number, bit: number): number {
  return (word ^ (2 ** bit)) >>> 0;
}

/** Why the program counter's switches chose the address they did. */
export function pcChoiceText({ request, signals }: PcSolution): string {
  if (request.jumpComputed) {
    return 'JumpReg is 1, so PC takes the address the ALU worked out, with its lowest bit at 0.';
  }
  if (request.jump) return 'Jump is 1, so PC takes PC + the immediate.';
  if (request.branch) {
    return request.taken
      ? 'Branch is 1 and the comparison came out true, so PC takes PC + the immediate.'
      : 'Branch is 1 but the comparison came out false, so PC takes PC + 4.';
  }
  return signals[PC.load]
    ? 'Neither Branch nor Jump is 1, so PC takes PC + 4.'
    : 'Neither Branch nor Jump is 1, and the instruction was not fetched: PC keeps its value.';
}

/**
 * What goes on at a moment of the clock cycle that ends the instruction; `loads` is PC's load
 * line, which is 0 when the instruction was run directly rather than fetched.
 */
export function pcPhaseText(phase: ClockPhase, loads: boolean): string {
  if (!loads) {
    if (phase === 'before')
      return 'The clock is low, and PC’s load line is 0: whatever waits at its input will not get in.';
    if (phase === 'high')
      return 'The clock has risen, but PC’s load line is 0: PC keeps its value, and nothing is fetched from a new address.';
    return 'The clock is low again. PC’s load line was 0, so PC still holds the address it held.';
  }
  switch (phase) {
    case 'before':
      return 'The clock is low. The next address waits at PC’s input, and PC still holds this instruction’s.';
    case 'high':
      return 'The clock has risen: PC took the address at its input. The next instruction is fetched from there.';
    case 'after':
      return 'The clock is low again. PC holds the next address until the clock rises once more.';
  }
}

/** The bits of a value, bit 0 first, for a row of the page. */
export function bitsOf(value: number, width: number): Bit[] {
  return Array.from({ length: width }, (_, bit) => bitOf(value, bit));
}

/** Why the page has no program counter to follow, for the word on show. */
export function pcAbsentText(fromCpu: ControlView | null): string {
  if (!fromCpu) return 'Run an instruction on the RISC-V CPU to see where PC goes after it.';
  return `${fromCpu.pcNote ?? 'PC is not shown for this instruction.'} So where PC went is not worked out here.`;
}
