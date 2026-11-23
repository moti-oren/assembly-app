import { describe, expect, it } from 'vitest';
import { checkChallenge, givenLines } from '../shared/challenge';
import type { Program } from '../shared/program';
import { RV32 } from './architecture';
import { CHALLENGES } from './challenges';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';

const ZERO = 0;
const T0 = 5;
const A0 = 10;
const A1 = 11;
const reg = (index: number): Operand => ({ type: 'reg', index });
const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** The lines a learner would add under the given ones. */
const SOLUTIONS: Record<string, Program<Instruction>> = {
  'rv32-negate': [line('xori', reg(A0), reg(A0), imm(-1)), line('addi', reg(A0), reg(A0), imm(1))],
  'rv32-absolute': [
    line('srai', reg(T0), reg(A0), imm(31)),
    line('xor', reg(A0), reg(A0), reg(T0)),
    line('sub', reg(A0), reg(A0), reg(T0))
  ],
  'rv32-times-ten': [
    line('slli', reg(T0), reg(A0), imm(3)),
    line('slli', reg(A0), reg(A0), imm(1)),
    line('add', reg(A0), reg(A0), reg(T0))
  ],
  'rv32-swap': [
    line('xor', reg(A0), reg(A0), reg(A1)),
    line('xor', reg(A1), reg(A1), reg(A0)),
    line('xor', reg(A0), reg(A0), reg(A1))
  ],
  // The given lines are L0 and L1, so the ANDI the branch comes back to is L3.
  'rv32-count-bits': [
    line('addi', reg(A1), reg(ZERO), imm(0)),
    line('andi', reg(T0), reg(A0), imm(1)),
    line('add', reg(A1), reg(A1), reg(T0)),
    line('srli', reg(A0), reg(A0), imm(1)),
    line('bne', reg(A0), reg(ZERO), { type: 'label', target: 3 })
  ]
};

describe('RISC-V shortcuts', () => {
  const judged = (id: string, own: Instruction[]) => {
    const challenge = CHALLENGES.find((each) => each.id === id)!;
    return checkChallenge(RV32, challenge, [...givenLines(challenge), ...own]);
  };

  it('does not pass a negation by multiplying by -1', () => {
    const result = judged('rv32-negate', [
      line('addi', reg(T0), reg(ZERO), imm(-1)),
      line('mul', reg(A0), reg(A0), reg(T0))
    ]);
    expect(result.solved).toBe(false);
  });

  it('does not pass a count that shifts the sign bit down for ever', () => {
    const result = judged('rv32-count-bits', [
      line('addi', reg(A1), reg(ZERO), imm(0)),
      line('andi', reg(T0), reg(A0), imm(1)),
      line('add', reg(A1), reg(A1), reg(T0)),
      line('srai', reg(A0), reg(A0), imm(1)),
      line('bne', reg(A0), reg(ZERO), { type: 'label', target: 3 })
    ]);
    expect(result.error).not.toBeNull();
    expect(result.solved).toBe(false);
  });
});

describe('RISC-V swap', () => {
  it('is not passed by going through a third register', () => {
    const swap = CHALLENGES.find(({ id }) => id === 'rv32-swap')!;
    const through = [
      line('addi', reg(T0), reg(A0), imm(0)),
      line('addi', reg(A0), reg(A1), imm(0)),
      line('addi', reg(A1), reg(T0), imm(0))
    ];
    const result = checkChallenge(RV32, swap, [...givenLines(swap), ...through]);
    expect(result.goals.map((goal) => goal.met)).toEqual([true, true, false]);
  });
});

describe('RISC-V challenges', () => {
  it('has a reference solution for every challenge, and no other', () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(CHALLENGES.map(({ id }) => id).sort());
  });

  it.each(CHALLENGES)('$id: the reference solution passes, in par', (challenge) => {
    const own = SOLUTIONS[challenge.id];
    const result = checkChallenge(RV32, challenge, [...givenLines(challenge), ...own]);
    expect(result.error).toBeNull();
    expect(result.goals.filter((goal) => !goal.met)).toEqual([]);
    expect(result.limits.filter((limit) => !limit.met)).toEqual([]);
    expect(result.solved).toBe(true);
    expect(own).toHaveLength(challenge.par);
  });

  it.each(CHALLENGES)('$id: the given lines alone do not pass', (challenge) => {
    expect(checkChallenge(RV32, challenge, givenLines(challenge)).solved).toBe(false);
  });

  it.each(CHALLENGES)('$id: every case tests every goal, from as many given lines', (challenge) => {
    for (const each of challenge.cases) {
      expect(each.met).toHaveLength(challenge.goals.length);
      expect(each.given).toHaveLength(givenLines(challenge).length);
    }
  });
});
