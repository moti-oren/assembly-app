import { describe, expect, it } from 'vitest';
import type { ChallengeResult } from '@/core/shared/challenge';
import { givenNote, isNews, outcomeText, solvedText } from './challengeView';

const result = (over: Partial<ChallengeResult>): ChallengeResult => ({
  goals: [
    { label: 'one', met: true },
    { label: 'two', met: false }
  ],
  limits: [{ label: 'three', met: true }],
  givenKept: true,
  error: null,
  lines: 2,
  solved: false,
  ...over
});

describe('givenNote', () => {
  it('names the lines a program starts with', () => {
    expect(givenNote(0)).toBeNull();
    expect(givenNote(1)).toBe('L0 is given, and locked: write under it.');
    expect(givenNote(2)).toBe('L0 to L1 are given, and locked: write under them.');
  });
});

describe('outcomeText', () => {
  it('counts what is met while the program is not there yet', () => {
    expect(outcomeText(result({}), 3)).toBe('2 of 3 met.');
    expect(outcomeText(result({ lines: 0 }), 3)).toBe('Nothing written yet.');
  });

  it('sets a solution against par', () => {
    expect(outcomeText(result({ solved: true, lines: 3 }), 3)).toBe(
      'Solved in 3 lines: that is par.'
    );
    expect(outcomeText(result({ solved: true, lines: 5 }), 3)).toBe(
      'Solved in 5 lines. It can be done in 3.'
    );
  });

  it('says why nothing can be met', () => {
    expect(outcomeText(result({ givenKept: false }), 3)).toBe(
      'The given lines were changed. Start over to get them back.'
    );
    expect(outcomeText(result({ error: 'Too many steps' }), 3)).toBe(
      'The program stopped: Too many steps'
    );
  });
});

describe('isNews', () => {
  it('is a solution or a reason nothing can pass, never the running count', () => {
    expect(isNews(result({}))).toBe(false);
    expect(isNews(result({ solved: true }))).toBe(true);
    expect(isNews(result({ givenKept: false }))).toBe(true);
    expect(isNews(result({ error: 'Too many steps' }))).toBe(true);
  });
});

describe('solvedText', () => {
  it('tells the fewest lines a challenge took', () => {
    expect(solvedText(1, 1)).toBe('Solved in 1 line, par');
    expect(solvedText(4, 3)).toBe('Solved in 4 lines; par is 3');
  });
});
