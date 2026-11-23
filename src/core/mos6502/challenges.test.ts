import { describe, expect, it } from 'vitest';
import { checkChallenge, givenLines } from '../shared/challenge';
import type { Program } from '../shared/program';
import { MOS6502 } from './architecture';
import { CHALLENGES } from './challenges';
import type { Instruction, Mnemonic } from './instructions';
import type { Index, Operand } from './operands';

const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number, index: Index | null = null): Operand => ({
  type: 'zp',
  address,
  index
});
const A: Operand = { type: 'acc' };
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** The lines a learner would add under the given ones. */
const SOLUTIONS: Record<string, Program<Instruction>> = {
  'mos6502-overflow': [line('lda', imm(0x7f)), line('adc', imm(0x01))],
  'mos6502-swap': [line('sta', zp(0x00)), line('txa'), line('ldx', zp(0x00))],
  'mos6502-times-ten': [
    line('asl', A),
    line('sta', zp(0x00)),
    line('asl', A),
    line('asl', A),
    line('clc'),
    line('adc', zp(0x00))
  ],
  'mos6502-decimal': [line('sed'), line('clc'), line('adc', imm(0x28))],
  // The given line is L0, so the STA that BPL comes back to is L2.
  'mos6502-fill': [
    line('ldx', imm(7)),
    line('sta', zp(0x10, 'x')),
    line('dex'),
    line('bpl', { type: 'label', target: 2 })
  ]
};

describe('6502 decimal sum', () => {
  it('is not passed by adding in binary', () => {
    const decimal = CHALLENGES.find(({ id }) => id === 'mos6502-decimal')!;
    // $2E is 28 with the 6 that corrects the low digit already in it: right for 19, not for 71.
    for (const added of [0x28, 0x2e]) {
      const binary = [line('clc'), line('adc', imm(added))];
      const result = checkChallenge(MOS6502, decimal, [...givenLines(decimal), ...binary]);
      expect(result.goals[0].met, `adc #$${added.toString(16)}`).toBe(false);
    }
  });
});

describe('6502 challenges', () => {
  it('has a reference solution for every challenge, and no other', () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(CHALLENGES.map(({ id }) => id).sort());
  });

  it.each(CHALLENGES)('$id: the reference solution passes, in par', (challenge) => {
    const own = SOLUTIONS[challenge.id];
    const result = checkChallenge(MOS6502, challenge, [...givenLines(challenge), ...own]);
    expect(result.error).toBeNull();
    expect(result.goals.filter((goal) => !goal.met)).toEqual([]);
    expect(result.limits.filter((limit) => !limit.met)).toEqual([]);
    expect(result.solved).toBe(true);
    expect(own).toHaveLength(challenge.par);
  });

  it.each(CHALLENGES)('$id: the given lines alone do not pass', (challenge) => {
    expect(checkChallenge(MOS6502, challenge, givenLines(challenge)).solved).toBe(false);
  });

  it.each(CHALLENGES)('$id: every case tests every goal, from as many given lines', (challenge) => {
    for (const each of challenge.cases) {
      expect(each.met).toHaveLength(challenge.goals.length);
      expect(each.given).toHaveLength(givenLines(challenge).length);
    }
  });
});
