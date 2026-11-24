import { resultTaps, tap, type AluCircuit, type AluLink, type FlagTap } from './aluLink';
import type { Bit } from './logic/gates';
import { repeatedStages, type ShiftDirection, type ShiftFill } from './logic/shifter';
import { mask } from './shared/numbers';
import type { ExecutionRecord } from './x86/execute';
import type { AluTrace } from './x86/executionContext';
import { isFlagSet } from './x86/flags';
import { isStringCompare, type Mnemonic } from './x86/instructions';

type Trace<Kind extends AluTrace['kind']> = Extract<AluTrace, { kind: Kind }>;

const SHIFTS: Partial<Record<Mnemonic, { direction: ShiftDirection; fill: ShiftFill }>> = {
  shl: { direction: 'left', fill: 'zero' },
  shr: { direction: 'right', fill: 'zero' },
  sar: { direction: 'right', fill: 'sign' },
  rol: { direction: 'left', fill: 'rotate' },
  ror: { direction: 'right', fill: 'rotate' },
  rcl: { direction: 'left', fill: 'carry' },
  rcr: { direction: 'right', fill: 'carry' }
};

const RESULT_TAPS: FlagTap[] = [...resultTaps('ZF', 'SF'), tap('PF', 'parity')];

/**
 * The 8086 subtracts by adding the inverse, so its CF and AF, which mean "a borrow", are the
 * opposite of the adder's carries.
 */
function arithmetic(alu: Trace<'add' | 'subtract'>, mnemonic: Mnemonic): AluCircuit {
  const subtract = alu.kind === 'subtract';
  const all = mask(alu.size);
  const name = mnemonic.toUpperCase();
  return {
    request: {
      kind: alu.kind,
      width: alu.size,
      a: alu.a & all,
      b: alu.b & all,
      carryIn: (subtract ? 1 - alu.carryIn : alu.carryIn) as Bit
    },
    taps: [
      ...(alu.updatesCarry ? [tap('CF', 'carryOut', subtract)] : []),
      tap('OF', 'overflow'),
      tap('AF', 'halfCarry', subtract),
      ...RESULT_TAPS
    ],
    cleared: [],
    resultKept: mnemonic !== 'cmp' && !isStringCompare(mnemonic),
    note: alu.updatesCarry
      ? null
      : `${name} leaves CF alone: the carry out of the top bit is not connected to it.`
  };
}

function logic(alu: Trace<'logic'>, mnemonic: Mnemonic): AluCircuit {
  const all = mask(alu.size);
  return {
    request: { kind: alu.operation, width: alu.size, a: alu.a & all, b: alu.b & all },
    taps: RESULT_TAPS,
    cleared: ['CF', 'OF', 'AF'],
    resultKept: mnemonic !== 'test',
    note: null
  };
}

function shift(alu: Trace<'shift'>, record: ExecutionRecord): AluLink {
  const { mnemonic } = record.instruction;
  const shape = SHIFTS[mnemonic];
  if (!shape) return { unavailable: `${mnemonic.toUpperCase()} has no shifter to show.` };
  const plain = shape.fill === 'zero' || shape.fill === 'sign';
  return {
    request: {
      kind: 'shift',
      width: alu.size,
      value: alu.original,
      ...shape,
      carryIn: isFlagSet(record.before.flags, 'CF') ? 1 : 0,
      stages: repeatedStages(alu.count)
    },
    taps: [
      tap('CF', 'carry'),
      ...(alu.count === 1 ? [tap('OF', 'signChanged')] : []),
      // Rotates leave SF, ZF and PF alone.
      ...(plain ? RESULT_TAPS : [])
    ],
    cleared: [],
    resultKept: true,
    note:
      alu.count === 1
        ? 'The 8086 shifts one place at a time; OF says whether the sign bit changed.'
        : `The 8086 shifts one place at a time, so a count of ${alu.count} is ${alu.count} rows. OF is only defined for a count of 1.`
  };
}

function withoutAlu(mnemonic: Mnemonic): AluLink {
  const name = mnemonic.toUpperCase();
  if (mnemonic === 'div' || mnemonic === 'idiv') {
    return {
      unavailable: `${name} divides by subtracting and shifting many times over; that circuit is not shown yet.`
    };
  }
  // NOT flips every bit on its own, a row of inverters: it is computed, just not drawn here.
  if (mnemonic === 'not') {
    return {
      unavailable: 'NOT inverts every bit by itself; that row of inverters is not shown yet.'
    };
  }
  return { unavailable: `${name} worked nothing out in the ALU.` };
}

/** The circuit behind an executed 8086 instruction, or why there is none to show. */
export function x86AluLink(record: ExecutionRecord): AluLink {
  const { alu, instruction } = record;
  const { mnemonic } = instruction;
  if (!alu) return withoutAlu(mnemonic);
  switch (alu.kind) {
    case 'add':
    case 'subtract':
      return arithmetic(alu, mnemonic);
    case 'logic':
      return logic(alu, mnemonic);
    case 'shift':
      return shift(alu, record);
    case 'multiply':
      return {
        unavailable: `${mnemonic.toUpperCase()} multiplies by adding and shifting many times over; that circuit is not shown yet.`
      };
    case 'restore':
      return {
        unavailable: `${mnemonic.toUpperCase()} loads FLAGS whole from the stack; nothing is worked out.`
      };
  }
}
