import { describe, expect, it } from 'vitest';
import { blockedReason, nextPhaseLabel } from './transportLabels';

describe('nextPhaseLabel', () => {
  it('names the phase that runs next and its place among the three', () => {
    expect(nextPhaseLabel(null)).toMatchObject({ name: 'Fetch', place: '1/3' });
    expect(nextPhaseLabel('fetch')).toMatchObject({ name: 'Decode', place: '2/3' });
    expect(nextPhaseLabel('decode')).toMatchObject({ name: 'Execute', place: '3/3' });
  });

  it('starts over after execute', () => {
    expect(nextPhaseLabel('execute')).toMatchObject({ name: 'Fetch', place: '1/3' });
  });

  it('speaks the text on the button first', () => {
    expect(nextPhaseLabel('fetch').spoken).toBe('Decode 2/3: step one phase');
  });
});

describe('blockedReason', () => {
  it('is null while there is a line to run', () => {
    expect(blockedReason(false, false)).toBeNull();
  });

  it('tells an empty program from one that ended', () => {
    expect(blockedReason(true, true)).toBe('Add a line to the program first');
    expect(blockedReason(true, false)).toContain('The program has ended');
  });
});
