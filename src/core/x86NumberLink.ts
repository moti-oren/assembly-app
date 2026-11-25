import {
  reads,
  shiftReadings,
  type FlagReading,
  type NumberLink,
  type NumberView
} from './numberLink';
import type { NumberRequest } from './representation/request';
import type { ScalingRequest } from './representation/scaling';
import { mask } from './shared/numbers';
import type { ExecutionRecord } from './x86/execute';
import type { AluTrace } from './x86/executionContext';
import { isStringCompare, type Instruction, type Mnemonic } from './x86/instructions';
import { formatOperand } from './x86/operands';

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
    flags: shiftReadings(request, SHIFT_NAMES),
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

/**
 * What the instruction calls its two inputs, as it wrote them. INC and DEC add or take a 1 they
 * do not name, NEG takes its operand from 0, and the string compares read what SI and DI point
 * at (SCAS the accumulator against [es:di]).
 */
function operandsOf({ mnemonic, operands }: Instruction, size: number): NumberView['operands'] {
  const [first, second] = operands;
  if (isStringCompare(mnemonic)) {
    const unit = size === 8 ? 'byte' : 'word';
    const source = mnemonic.startsWith('scas') ? (size === 8 ? 'al' : 'ax') : `${unit} [ds:si]`;
    return { a: source, b: `${unit} [es:di]` };
  }
  if (mnemonic === 'neg') return { a: '0', b: first ? formatOperand(first) : '' };
  return { a: first ? formatOperand(first) : '', b: second ? formatOperand(second) : '1' };
}

const SHIFT_NAMES = { carry: 'CF', overflow: 'OF', zero: 'ZF', negative: 'SF' };

const WORD_AT_A_TIME =
  'The 8086 works on 8 or 16 bits: 32 take two instructions, a word at a time, so only the flags that still answer for the whole number are given.';

/** A shift of no place: the 8086 changes no flag for a count of 0. */
const STILL = 'No place moved: the 8086 changes no flag when the count is 0.';

/**
 * A request made by hand, with the flags the 8086 would set for it and what they mean. Wider than
 * its 16 bits a program takes two instructions: a sum or a difference still gets CF, OF and SF
 * from the high word, but ZF is the high word's alone, and a shift (SHL and RCL, or SHR and RCR)
 * keeps only CF whole. What the program would not give is left out, with a note.
 */
export function x86FreeView(request: NumberRequest): NumberView {
  const view = (flags: FlagReading[], note: string | null, comparable = true): NumberView => ({
    request,
    flags,
    resultKept: true,
    comparable,
    note
  });
  const wide = 'width' in request && request.width > 16;
  switch (request.kind) {
    case 'add':
    case 'subtract': {
      const flags = [
        reads('CF', 'unsigned', 'outside'),
        reads('OF', 'signed', 'outside'),
        ...RESULT_FLAGS
      ];
      return wide
        ? view(
            flags.filter((reading) => reading.flag !== 'ZF'),
            WORD_AT_A_TIME,
            false
          )
        : view(flags, null);
    }
    case 'shift': {
      if (request.count === 0) return view([], STILL);
      const flags = shiftReadings(request, SHIFT_NAMES);
      return wide
        ? view(
            flags.filter((reading) => reading.flag === 'CF'),
            WORD_AT_A_TIME,
            false
          )
        : view(flags, null);
    }
    case 'bcd':
      return view([reads('CF', 'decimal', 'outside')], null);
    default:
      return view([], null);
  }
}

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
  if (alu.kind === 'add' || alu.kind === 'subtract') {
    const link = arithmetic(alu, instruction.mnemonic);
    return 'request' in link ? { ...link, operands: operandsOf(instruction, alu.size) } : link;
  }
  if (alu.kind === 'shift') return scaling(alu, instruction.mnemonic);
  return { unavailable: `${name} ${UNAVAILABLE[alu.kind]}` };
}
