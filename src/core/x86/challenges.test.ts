import { describe, expect, it } from 'vitest';
import { checkChallenge, givenLines } from '../shared/challenge';
import type { Program } from '../shared/program';
import { X86 } from './architecture';
import { CHALLENGES } from './challenges';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';

const reg = (name: Extract<Operand, { type: 'reg' }>['name']): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

describe('8086 zero', () => {
  it('is not passed by borrowing a zero from a fresh CPU', () => {
    const zero = CHALLENGES.find(({ id }) => id === 'x86-zero')!;
    const borrowed = [
      line('and', reg('ax'), reg('cx')),
      line('mul', reg('bx')),
      line('xchg', reg('ax'), reg('si')),
      line('lodsw'),
      line('pop', reg('ax'))
    ];
    for (const own of borrowed) {
      const result = checkChallenge(X86, zero, [...givenLines(zero), own]);
      expect(result.goals[0].met, own.mnemonic).toBe(false);
    }
  });
});

/** The lines a learner would add under the given ones. */
const SOLUTIONS: Record<string, Program<Instruction>> = {
  'x86-overflow': [line('mov', reg('al'), imm(0x7f)), line('add', reg('al'), imm(1))],
  'x86-zero': [line('xor', reg('ax'), reg('ax'))],
  'x86-times-ten': [
    line('shl', reg('ax'), imm(1)),
    line('mov', reg('bx'), reg('ax')),
    line('shl', reg('ax'), imm(1)),
    line('shl', reg('ax'), imm(1)),
    line('add', reg('ax'), reg('bx'))
  ],
  'x86-swap': [
    line('xor', reg('ax'), reg('bx')),
    line('xor', reg('bx'), reg('ax')),
    line('xor', reg('ax'), reg('bx'))
  ],
  // The given line is L0, so the ADD that LOOP comes back to is L2.
  'x86-sum': [
    line('xor', reg('ax'), reg('ax')),
    line('add', reg('ax'), reg('cx')),
    line('loop', { type: 'label', target: 2 })
  ]
};

describe('8086 challenges', () => {
  it('has a reference solution for every challenge, and no other', () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(CHALLENGES.map(({ id }) => id).sort());
  });

  it.each(CHALLENGES)('$id: the reference solution passes, in par', (challenge) => {
    const own = SOLUTIONS[challenge.id];
    const result = checkChallenge(X86, challenge, [...givenLines(challenge), ...own]);
    expect(result.error).toBeNull();
    expect(result.goals.filter((goal) => !goal.met)).toEqual([]);
    expect(result.limits.filter((limit) => !limit.met)).toEqual([]);
    expect(result.solved).toBe(true);
    expect(own).toHaveLength(challenge.par);
  });

  it.each(CHALLENGES)('$id: the given lines alone do not pass', (challenge) => {
    expect(checkChallenge(X86, challenge, givenLines(challenge)).solved).toBe(false);
  });

  it.each(CHALLENGES)('$id: every case tests every goal, from as many given lines', (challenge) => {
    for (const each of challenge.cases) {
      expect(each.met).toHaveLength(challenge.goals.length);
      expect(each.given).toHaveLength(givenLines(challenge).length);
    }
  });
});
