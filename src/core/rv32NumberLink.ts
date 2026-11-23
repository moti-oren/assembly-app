import { reads, type FlagReading, type NumberLink, type NumberView } from './numberLink';
import type { ArithmeticRequest } from './representation/arithmetic';
import type { AluTrace, ExecutionRecord, MemoryAccess } from './rv32/execute';
import type { Mnemonic } from './rv32/instructions';
import { BRANCH_TAKEN, SET_RESULT } from './rv32AluLink';

const WIDTH = 32;

const difference = (a: number, b: number): ArithmeticRequest => ({
  kind: 'subtract',
  width: WIDTH,
  a,
  b,
  extra: 0
});

/** Each branch asks one question of a − b, and the mnemonic picks the scale it is asked on. */
const BRANCHES: Partial<Record<Mnemonic, FlagReading>> = {
  beq: reads(BRANCH_TAKEN, 'unsigned', 'zero'),
  bne: reads(BRANCH_TAKEN, 'unsigned', 'zero', true),
  blt: reads(BRANCH_TAKEN, 'signed', 'below'),
  bge: reads(BRANCH_TAKEN, 'signed', 'below', true),
  bltu: reads(BRANCH_TAKEN, 'unsigned', 'below'),
  bgeu: reads(BRANCH_TAKEN, 'unsigned', 'below', true)
};

/** The loads that bring in less than a word, and how each fills the rest of the register. */
const NARROW_LOADS: Partial<Record<Mnemonic, boolean>> = {
  lb: true,
  lh: true,
  lbu: false,
  lhu: false
};

const NO_FLAGS = 'RISC-V keeps no flags: when the answer does not fit, nothing records it.';

function compared(a: number, b: number, reading: FlagReading, note: string): NumberView {
  return { request: difference(a, b), flags: [reading], resultKept: false, note };
}

function extended(access: MemoryAccess, signed: boolean): NumberView {
  return {
    request: { kind: 'extend', value: access.value, from: access.size * 8, to: WIDTH, signed },
    flags: [],
    resultKept: true,
    note: signed
      ? 'A signed load copies the top bit, so a negative number stays the same number.'
      : 'An unsigned load fills with zeros, so the value is never negative.'
  };
}

function computed(alu: AluTrace): NumberLink {
  const { operation, a, b } = alu;
  const less = 'The same bits, compared on one scale: rd gets 1 when a is the smaller.';
  switch (operation) {
    case 'add':
      return {
        request: { kind: 'add', width: WIDTH, a, b, extra: 0 },
        flags: [],
        resultKept: true,
        note: NO_FLAGS
      };
    case 'sub':
      return { request: difference(a, b), flags: [], resultKept: true, note: NO_FLAGS };
    case 'slt':
      return compared(a, b, reads(SET_RESULT, 'signed', 'below'), less);
    case 'sltu':
      return compared(a, b, reads(SET_RESULT, 'unsigned', 'below'), less);
    case 'and':
    case 'or':
    case 'xor':
      return {
        unavailable: `${operation.toUpperCase()} works on each bit by itself: the bits are not read as one number.`
      };
    default:
      return { unavailable: `${operation.toUpperCase()} is not shown as numbers yet.` };
  }
}

/** An executed RISC-V instruction as arithmetic on numbers, or why there is nothing to show. */
export function rv32NumberLink(record: ExecutionRecord): NumberLink {
  const { alu, access, comparison, instruction } = record;
  const { mnemonic } = instruction;
  const question = BRANCHES[mnemonic];
  if (comparison && question) {
    return compared(
      comparison.a,
      comparison.b,
      question,
      'A branch compares its two registers; the mnemonic says on which scale.'
    );
  }
  const signed = NARROW_LOADS[mnemonic];
  if (access && signed !== undefined) return extended(access, signed);
  if (alu) return computed(alu);
  return { unavailable: `${mnemonic.toUpperCase()} worked nothing out.` };
}
