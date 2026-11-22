/**
 * The instruction builder's keys. Once the box holds words or text, the plain arrows move
 * within the box and Alt+arrows move through the choices; while it is empty, the plain arrows
 * move through the choices.
 */

/** Where focus goes in the box: a word (its index), or the text input at the word count. */
export interface BoxTarget {
  target: number;
  /** Where the caret goes when the target is the text input. */
  caret: 'start' | 'end';
}

/**
 * Where an arrow key moves within the box, or null to leave it to the text input. `at` is the
 * word that has focus, or `words` for the text input. Left and Right step between words and
 * into the text; Up and Down go to the start and the end of the box.
 */
export function boxMove(
  at: number,
  words: number,
  key: string,
  caretAtStart: boolean
): BoxTarget | null {
  const input = at >= words;
  switch (key) {
    case 'ArrowUp':
      return words > 0 ? { target: 0, caret: 'start' } : { target: words, caret: 'start' };
    case 'ArrowDown':
      return { target: words, caret: 'end' };
    case 'ArrowLeft':
      if (!input) return { target: Math.max(0, at - 1), caret: 'end' };
      return caretAtStart && words > 0 ? { target: words - 1, caret: 'end' } : null;
    case 'ArrowRight':
      return input ? null : { target: at + 1, caret: 'start' };
    default:
      return null;
  }
}

/** One hint in the row under the builder: the keys to press together, and what they do. */
export interface KeyHint {
  keys: string[];
  label: string;
}

export interface BuilderKeyState {
  /** The box holds words or text, so the plain arrows belong to it. */
  boxBusy: boolean;
  /** Enter would run the instruction (and Shift+Enter add it) rather than pick a choice. */
  enterRuns: boolean;
  /** Enter would pick the marked choice. */
  canPick: boolean;
  /** There is more than one choice to move between. */
  canMove: boolean;
  /** What the Alt key is called on this keyboard. */
  altKey: string;
  /** The box holds a program line being edited: Enter replaces it and Esc leaves it as it was. */
  editing?: boolean;
}

/** The keys that do something right now, in the order the row shows them. */
export function keyHints(state: BuilderKeyState): KeyHint[] {
  const hints: KeyHint[] = [];
  if (state.canMove) {
    hints.push({ keys: state.boxBusy ? [state.altKey, '←↑↓→'] : ['←↑↓→'], label: 'move' });
  }
  if (state.enterRuns && state.editing) {
    hints.push({ keys: ['Enter'], label: 'replace' });
  } else if (state.enterRuns) {
    hints.push({ keys: ['Enter'], label: 'run now' }, { keys: ['⇧', 'Enter'], label: 'add' });
  } else if (state.canPick) {
    hints.push({ keys: ['Enter'], label: 'pick' });
  }
  if (state.editing) hints.push({ keys: ['Esc'], label: 'cancel' });
  else if (state.boxBusy) hints.push({ keys: ['Esc'], label: 'clear' });
  return hints;
}
