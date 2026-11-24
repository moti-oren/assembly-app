import type { Relation } from '@/core/representation/comparison';
import type { Scale } from '@/core/representation/readings';
import type { FlagName } from '@/core/x86/flags';
import type { Mnemonic } from '@/core/x86/instructions';
import type { ArchitectureId } from './architectures';
import { JUMP_RULES } from './x86Jumps';

/** What working out A − B leaves to decide by, whatever a CPU calls its flags. */
export interface DifferenceFlags {
  /** The unsigned answer did not fit: one more had to be borrowed. */
  borrow: boolean;
  /** The signed answer did not fit. */
  overflow: boolean;
  zero: boolean;
  /** The top bit of the difference. */
  negative: boolean;
}

/** One conditional jump: the question it stands for, and how the CPU decides it. */
export interface Condition {
  mnemonic: string;
  /** The scale the question is asked on; null where it is the same on both. */
  scale: Scale | null;
  relation: Relation;
  /** What the CPU goes by, in its own words. */
  when: string;
  taken(flags: DifferenceFlags): boolean;
  /** Why the jump does not always answer the question it seems to, when it does not. */
  caveat?: string;
}

/** The jumps a CPU has for the two numbers it just compared. */
export interface ConditionSet {
  /** How a program of this CPU gets from two numbers to a jump. */
  lead: string;
  /** What the CPU calls going to the target. */
  verb: 'jumps' | 'branches';
  conditions: readonly Condition[];
}

const X86_FLAGS: Partial<Record<FlagName, keyof DifferenceFlags>> = {
  CF: 'borrow',
  ZF: 'zero',
  SF: 'negative',
  OF: 'overflow'
};

/** A jump of the 8086, decided by the rule the cycle panel explains it with. */
function x86(mnemonic: Mnemonic, scale: Scale | null, relation: Relation): Condition {
  const rule = JUMP_RULES[mnemonic];
  if (!rule) throw new Error(`${mnemonic} has no jump rule to decide by.`);
  return {
    mnemonic: mnemonic.toUpperCase(),
    scale,
    relation,
    when: rule.when,
    taken: (flags) =>
      rule.holds((name) => {
        const flag = X86_FLAGS[name];
        return flag !== undefined && flags[flag];
      }, 0)
  };
}

const X86: ConditionSet = {
  lead: 'A jump reads the flags a subtraction left. CMP A, B works out A − B for its flags alone.',
  verb: 'jumps',
  conditions: [
    x86('je', null, 'equal'),
    x86('jne', null, 'notEqual'),
    x86('jb', 'unsigned', 'less'),
    x86('jbe', 'unsigned', 'lessOrEqual'),
    x86('ja', 'unsigned', 'greater'),
    x86('jae', 'unsigned', 'greaterOrEqual'),
    x86('jl', 'signed', 'less'),
    x86('jle', 'signed', 'lessOrEqual'),
    x86('jg', 'signed', 'greater'),
    x86('jge', 'signed', 'greaterOrEqual')
  ]
};

const signedLess = (flags: DifferenceFlags): boolean => flags.negative !== flags.overflow;

const RV32: ConditionSet = {
  lead: 'RISC-V keeps no flags: a branch compares its two registers itself, and its name says on which scale.',
  verb: 'branches',
  conditions: [
    {
      mnemonic: 'BEQ',
      scale: null,
      relation: 'equal',
      when: 'the same bits',
      taken: (f) => f.zero
    },
    {
      mnemonic: 'BNE',
      scale: null,
      relation: 'notEqual',
      when: 'different bits',
      taken: (f) => !f.zero
    },
    {
      mnemonic: 'BLTU',
      scale: 'unsigned',
      relation: 'less',
      when: 'an unsigned comparison',
      taken: (f) => f.borrow
    },
    {
      mnemonic: 'BGEU',
      scale: 'unsigned',
      relation: 'greaterOrEqual',
      when: 'an unsigned comparison',
      taken: (f) => !f.borrow
    },
    {
      mnemonic: 'BLT',
      scale: 'signed',
      relation: 'less',
      when: 'a signed comparison',
      taken: signedLess
    },
    {
      mnemonic: 'BGE',
      scale: 'signed',
      relation: 'greaterOrEqual',
      when: 'a signed comparison',
      taken: (f) => !signedLess(f)
    }
  ]
};

const SIGN_ONLY =
  'N is only the top bit of A − B. When the signed answer does not fit, that bit is wrong: the 6502 has no signed comparison, so a program subtracts with SBC and reads N together with V.';

const MOS6502: ConditionSet = {
  lead: 'A branch reads the flags a subtraction left, and CMP subtracts for its flags alone. C works backwards: it is 1 when nothing was borrowed.',
  verb: 'branches',
  conditions: [
    { mnemonic: 'BEQ', scale: null, relation: 'equal', when: 'Z = 1', taken: (f) => f.zero },
    { mnemonic: 'BNE', scale: null, relation: 'notEqual', when: 'Z = 0', taken: (f) => !f.zero },
    {
      mnemonic: 'BCC',
      scale: 'unsigned',
      relation: 'less',
      when: 'C = 0',
      taken: (f) => f.borrow
    },
    {
      mnemonic: 'BCS',
      scale: 'unsigned',
      relation: 'greaterOrEqual',
      when: 'C = 1',
      taken: (f) => !f.borrow
    },
    {
      mnemonic: 'BMI',
      scale: 'signed',
      relation: 'less',
      when: 'N = 1',
      taken: (f) => f.negative,
      caveat: SIGN_ONLY
    },
    {
      mnemonic: 'BPL',
      scale: 'signed',
      relation: 'greaterOrEqual',
      when: 'N = 0',
      taken: (f) => !f.negative,
      caveat: SIGN_ONLY
    }
  ]
};

/** The jumps each CPU has for a comparison. */
export const CONDITION_SETS: Record<ArchitectureId, ConditionSet> = {
  x86: X86,
  rv32: RV32,
  mos6502: MOS6502
};
