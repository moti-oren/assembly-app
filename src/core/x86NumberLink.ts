import { reads, shiftReadings, type FlagReading, type NumberLink } from './numberLink';
import type { ScalingRequest } from './representation/scaling';
import { mask } from './shared/numbers';
import type { ExecutionRecord } from './x86/execute';
import type { AluTrace } from './x86/executionContext';
import { isStringCompare, type Mnemonic } from './x86/instructions';

type Trace<Kind extends AluTrace['kind']> = Extract<AluTrace, { kind: Kind }>;

const RESULT_FLAGS: FlagReading[] = [
  reads('ZF', 'unsigned', 'zero'),
  reads('SF', 'signed', 'negative')
];

const COMPARED =
  'After a comparison JA and JB go by the unsigned answer (CF); JG and JL by the signed one (SF and OF).';

/**
 * The 8086 keeps one flag for each scale: CF says the unsigned answer did not fit, OF says the
 * signed one did not. When subtracting, CF is the borrow, which is the same thing.
 */
function arithmetic(alu: Trace<'add' | 'subtract'>, mnemonic: Mnemonic): NumberLink {
  const all = mask(alu.size);
  const compares = mnemonic === 'cmp' || isStringCompare(mnemonic);
  return {
    request: {
      kind: alu.kind,
      width: alu.size,
      a: alu.a & all,
      b: alu.b & all,
      extra: alu.carryIn ? 1 : 0
    },
    flags: [
      ...(alu.updatesCarry ? [reads('CF', 'unsigned', 'outside')] : []),
      reads('OF', 'signed', 'outside'),
      ...RESULT_FLAGS
    ],
    resultKept: !compares,
    comparable: alu.updatesCarry,
    note: compares
      ? COMPARED
      : alu.updatesCarry
        ? null
        : `${mnemonic.toUpperCase()} leaves CF alone: when the unsigned answer wraps no flag says so, and OF still says when the signed one does.`
  };
}

/** The shifts that multiply or divide: a rotate loses no bit, so it does neither. */
const SCALINGS: Partial<Record<Mnemonic, Pick<ScalingRequest, 'direction' | 'fill'>>> = {
  shl: { direction: 'left', fill: 'zero' },
  shr: { direction: 'right', fill: 'zero' },
  sar: { direction: 'right', fill: 'sign' }
};

/**
 * SHL doubles and SHR and SAR halve, each place. CF and OF answer for one place only: the 8086
 * leaves OF undefined after more, and CF is then just the last bit pushed out.
 */
function scaling(alu: Trace<'shift'>, mnemonic: Mnemonic): NumberLink {
  const shape = SCALINGS[mnemonic];
  if (!shape) {
    return {
      unavailable: `${mnemonic.toUpperCase()} turns the bits round and loses none: that is not a multiplication or a division.`
    };
  }
  const request: ScalingRequest = {
    kind: 'shift',
    width: alu.size,
    value: alu.original & mask(alu.size),
    ...shape,
    count: alu.count
  };
  return {
    request,
    flags: shiftReadings(request, { carry: 'CF', overflow: 'OF', zero: 'ZF', negative: 'SF' }),
    resultKept: true,
    comparable: false,
    note:
      alu.count === 1
        ? null
        : 'After more than one place CF is only the last bit pushed out, and OF says nothing.'
  };
}

const UNAVAILABLE: Record<Exclude<AluTrace['kind'], 'add' | 'subtract' | 'shift'>, string> = {
  logic: 'works on each bit by itself: the bits are not read as one number.',
  multiply: 'multiplies; that is not shown as numbers yet.',
  restore: 'loads FLAGS whole from the stack; nothing is worked out.'
};

/** An executed 8086 instruction as arithmetic on numbers, or why there is nothing to show. */
export function x86NumberLink(record: ExecutionRecord): NumberLink {
  const { alu, instruction } = record;
  const name = instruction.mnemonic.toUpperCase();
  if (!alu) {
    const divides = instruction.mnemonic === 'div' || instruction.mnemonic === 'idiv';
    return {
      unavailable: divides
        ? `${name} divides; that is not shown as numbers yet.`
        : `${name} worked nothing out.`
    };
  }
  if (alu.kind === 'add' || alu.kind === 'subtract') return arithmetic(alu, instruction.mnemonic);
  if (alu.kind === 'shift') return scaling(alu, instruction.mnemonic);
  return { unavailable: `${name} ${UNAVAILABLE[alu.kind]}` };
}
