import type { AluTrace, ExecutionRecord } from './mos6502/executionContext';
import type { Mnemonic } from './mos6502/instructions';
import { reads, type FlagReading, type NumberLink, type NumberView } from './numberLink';

const WIDTH = 8;

const RESULT_FLAGS: FlagReading[] = [
  reads('Z', 'unsigned', 'zero'),
  reads('N', 'signed', 'negative')
];

/**
 * C is the unsigned scale's flag and V the signed one's. The 6502 has no borrow: after SBC and
 * the comparisons C is 1 when nothing had to be borrowed, the opposite of the 8086's CF.
 */
function binary(alu: AluTrace): NumberView {
  const adding = alu.operation === 'add';
  return {
    request: {
      kind: adding ? 'add' : 'subtract',
      width: WIDTH,
      a: alu.a,
      b: alu.b,
      extra: alu.carryIn === adding ? 1 : 0
    },
    flags: [
      reads('C', 'unsigned', 'outside', !adding),
      reads('V', 'signed', 'outside'),
      ...RESULT_FLAGS
    ],
    resultKept: true,
    comparable: true,
    note: adding
      ? null
      : 'C works backwards here: 1 means no borrow, 0 means one more is taken off.'
  };
}

function decimal(alu: AluTrace): NumberView {
  const adding = alu.operation === 'add';
  return {
    request: {
      kind: 'bcd',
      operation: adding ? 'add' : 'subtract',
      a: alu.a,
      b: alu.b,
      extra: alu.carryIn === adding ? 1 : 0
    },
    flags: [reads('C', 'decimal', 'outside', !adding)],
    resultKept: true,
    comparable: false,
    note: 'In decimal mode each half of the byte is one digit, and C carries a hundred.'
  };
}

function step(alu: AluTrace, mnemonic: Mnemonic): NumberView {
  return {
    request: {
      kind: mnemonic.startsWith('de') ? 'subtract' : 'add',
      width: WIDTH,
      a: alu.a,
      b: 1,
      extra: 0
    },
    flags: RESULT_FLAGS,
    resultKept: true,
    comparable: false,
    note: `${mnemonic.toUpperCase()} leaves C and V alone, so nothing says when it wrapped.`
  };
}

function computed(alu: AluTrace, mnemonic: Mnemonic): NumberLink {
  const name = mnemonic.toUpperCase();
  switch (alu.operation) {
    case 'add':
    case 'subtract':
      return alu.decimal ? decimal(alu) : binary(alu);
    case 'compare':
      return {
        request: { kind: 'subtract', width: WIDTH, a: alu.a, b: alu.b, extra: 0 },
        flags: [reads('C', 'unsigned', 'below', true), ...RESULT_FLAGS],
        resultKept: false,
        comparable: true,
        note: 'The 6502 compares on the unsigned scale only: no V is worked out.'
      };
    case 'step':
      return step(alu, mnemonic);
    case 'logic':
    case 'bit':
      return {
        unavailable: `${name} works on each bit by itself: the bits are not read as one number.`
      };
    case 'shift':
      return { unavailable: `${name} moves the bits along; that is not shown as numbers yet.` };
  }
}

/** An executed 6502 instruction as arithmetic on numbers, or why there is nothing to show. */
export function mos6502NumberLink(record: ExecutionRecord): NumberLink {
  const { alu, instruction } = record;
  if (!alu) return { unavailable: `${instruction.mnemonic.toUpperCase()} worked nothing out.` };
  return computed(alu, instruction.mnemonic);
}
