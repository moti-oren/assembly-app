import { reads, type FlagReading, type NumberLink } from './numberLink';
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
    note: compares
      ? COMPARED
      : alu.updatesCarry
        ? null
        : `${mnemonic.toUpperCase()} leaves CF alone: when the unsigned answer wraps no flag says so, and OF still says when the signed one does.`
  };
}

const UNAVAILABLE: Record<Exclude<AluTrace['kind'], 'add' | 'subtract'>, string> = {
  logic: 'works on each bit by itself: the bits are not read as one number.',
  shift: 'moves the bits along; that is not shown as numbers yet.',
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
  return { unavailable: `${name} ${UNAVAILABLE[alu.kind]}` };
}
