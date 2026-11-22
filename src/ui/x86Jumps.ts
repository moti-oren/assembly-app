import type { FlagName } from '@/core/x86/flags';
import type { Mnemonic } from '@/core/x86/instructions';

/** What a conditional jump of the 8086 tests before it jumps. */
export interface JumpRule {
  /** The condition, as the instruction reference writes it. */
  when: string;
  /** The flags the condition reads. */
  flags: readonly FlagName[];
  /** True when it reads CX too: as it is for JCXZ, after counting it down for the LOOPs. */
  cx?: boolean;
  /** Whether the jump is taken, given the flags and the CX it tests. */
  holds(flag: (name: FlagName) => boolean, cx: number): boolean;
}

type Flag = (name: FlagName) => boolean;

const signedLess = (flag: Flag) => flag('SF') !== flag('OF');

const zero: JumpRule = { when: 'ZF = 1', flags: ['ZF'], holds: (flag) => flag('ZF') };
const notZero: JumpRule = { when: 'ZF = 0', flags: ['ZF'], holds: (flag) => !flag('ZF') };
const carry: JumpRule = { when: 'CF = 1', flags: ['CF'], holds: (flag) => flag('CF') };
const noCarry: JumpRule = { when: 'CF = 0', flags: ['CF'], holds: (flag) => !flag('CF') };

/**
 * The condition of every jump that has one. The CPU decides in `handlers.ts`; this table says the
 * same in words, and its test runs each jump on the real core to keep the two in step.
 */
export const JUMP_RULES: Partial<Record<Mnemonic, JumpRule>> = {
  je: zero,
  jz: zero,
  jne: notZero,
  jnz: notZero,
  ja: {
    when: 'CF = 0 and ZF = 0',
    flags: ['CF', 'ZF'],
    holds: (flag) => !flag('CF') && !flag('ZF')
  },
  jae: noCarry,
  jb: carry,
  jbe: {
    when: 'CF = 1 or ZF = 1',
    flags: ['CF', 'ZF'],
    holds: (flag) => flag('CF') || flag('ZF')
  },
  jg: {
    when: 'ZF = 0 and SF = OF',
    flags: ['ZF', 'SF', 'OF'],
    holds: (flag) => !flag('ZF') && !signedLess(flag)
  },
  jge: { when: 'SF = OF', flags: ['SF', 'OF'], holds: (flag) => !signedLess(flag) },
  jl: { when: 'SF ≠ OF', flags: ['SF', 'OF'], holds: signedLess },
  jle: {
    when: 'ZF = 1 or SF ≠ OF',
    flags: ['ZF', 'SF', 'OF'],
    holds: (flag) => flag('ZF') || signedLess(flag)
  },
  jc: carry,
  jnc: noCarry,
  js: { when: 'SF = 1', flags: ['SF'], holds: (flag) => flag('SF') },
  jns: { when: 'SF = 0', flags: ['SF'], holds: (flag) => !flag('SF') },
  jo: { when: 'OF = 1', flags: ['OF'], holds: (flag) => flag('OF') },
  jno: { when: 'OF = 0', flags: ['OF'], holds: (flag) => !flag('OF') },
  jp: { when: 'PF = 1', flags: ['PF'], holds: (flag) => flag('PF') },
  jnp: { when: 'PF = 0', flags: ['PF'], holds: (flag) => !flag('PF') },
  jcxz: { when: 'CX = 0', flags: [], cx: true, holds: (_, cx) => cx === 0 },
  loop: {
    when: 'CX ≠ 0 after counting it down',
    flags: [],
    cx: true,
    holds: (_, cx) => cx !== 0
  },
  loope: {
    when: 'CX ≠ 0 after counting it down and ZF = 1',
    flags: ['ZF'],
    cx: true,
    holds: (flag, cx) => cx !== 0 && flag('ZF')
  },
  loopne: {
    when: 'CX ≠ 0 after counting it down and ZF = 0',
    flags: ['ZF'],
    cx: true,
    holds: (flag, cx) => cx !== 0 && !flag('ZF')
  }
};
