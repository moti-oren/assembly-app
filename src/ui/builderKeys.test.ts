import { describe, expect, it } from 'vitest';
import { boxMove, keyHints, type BuilderKeyState } from './builderKeys';

describe('boxMove', () => {
  describe('from the text input', () => {
    it('goes back to the last word when the caret is at the start', () => {
      expect(boxMove(3, 3, 'ArrowLeft', true)).toEqual({ target: 2, caret: 'end' });
    });

    it('leaves Left to the input while the caret can still move left', () => {
      expect(boxMove(3, 3, 'ArrowLeft', false)).toBeNull();
    });

    it('leaves Left to the input when there are no words', () => {
      expect(boxMove(0, 0, 'ArrowLeft', true)).toBeNull();
    });

    it('always leaves Right to the input', () => {
      expect(boxMove(3, 3, 'ArrowRight', true)).toBeNull();
    });
  });

  describe('from a word', () => {
    it('steps left, and stays on the first word', () => {
      expect(boxMove(2, 3, 'ArrowLeft', false)).toEqual({ target: 1, caret: 'end' });
      expect(boxMove(0, 3, 'ArrowLeft', false)).toEqual({ target: 0, caret: 'end' });
    });

    it('steps right, from the last word into the start of the text', () => {
      expect(boxMove(0, 3, 'ArrowRight', false)).toEqual({ target: 1, caret: 'start' });
      expect(boxMove(2, 3, 'ArrowRight', false)).toEqual({ target: 3, caret: 'start' });
    });
  });

  describe('Up and Down', () => {
    it('go to the first word and to the end of the text', () => {
      expect(boxMove(3, 3, 'ArrowUp', false)).toEqual({ target: 0, caret: 'start' });
      expect(boxMove(1, 3, 'ArrowDown', false)).toEqual({ target: 3, caret: 'end' });
    });

    it('go to the ends of the text when there are no words', () => {
      expect(boxMove(0, 0, 'ArrowUp', false)).toEqual({ target: 0, caret: 'start' });
      expect(boxMove(0, 0, 'ArrowDown', false)).toEqual({ target: 0, caret: 'end' });
    });
  });

  it('ignores other keys', () => {
    expect(boxMove(3, 3, 'Home', true)).toBeNull();
  });
});

describe('keyHints', () => {
  const base: BuilderKeyState = {
    boxBusy: false,
    enterRuns: false,
    canPick: true,
    canMove: true,
    altKey: 'Alt'
  };
  const text = (state: BuilderKeyState) =>
    keyHints(state).map((hint) => `${hint.keys.join('+')} ${hint.action}`);

  it('uses the plain arrows while the box is empty', () => {
    expect(text(base)).toEqual(['←↑↓→ move', 'Enter pick']);
  });

  it('asks for Alt once the box holds words or text', () => {
    expect(text({ ...base, boxBusy: true, altKey: '⌥' })).toEqual([
      '⌥+←↑↓→ move',
      'Enter pick',
      'Esc clear'
    ]);
  });

  it('offers run and add once Enter would run', () => {
    expect(
      text({ ...base, boxBusy: true, enterRuns: true, canPick: false, canMove: false })
    ).toEqual(['Enter run', '⇧+Enter add', 'Esc clear']);
  });

  it('leaves out moving when there is a single choice', () => {
    expect(text({ ...base, canMove: false })).toEqual(['Enter pick']);
  });
});
