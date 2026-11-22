/** What a shortcut does to the program on show. */
export type TransportAction = 'step' | 'run' | 'undo' | 'redo';

/** The parts of a key press a shortcut is told by. */
export interface KeyPress {
  key: string;
  /** The physical key, so Z is found on a keyboard layout without a Latin Z. */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * The action a key press asks for, or null. F10 steps a line and F8 runs or pauses, wherever
 * the focus is. Undo and redo are the usual Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y (Cmd on an Apple
 * keyboard), but not while `typing`: there they belong to the text being typed.
 */
export function transportAction(press: KeyPress, typing: boolean): TransportAction | null {
  const command = press.ctrlKey || press.metaKey;
  if (!command && !press.altKey && !press.shiftKey) {
    if (press.key === 'F10') return 'step';
    if (press.key === 'F8') return 'run';
    return null;
  }
  if (!command || press.altKey || typing) return null;
  if (press.code === 'KeyZ') return press.shiftKey ? 'redo' : 'undo';
  if (press.code === 'KeyY' && !press.shiftKey) return 'redo';
  return null;
}

/** The keys of each shortcut as they are shown, one keycap per entry. */
export function transportKeys(apple: boolean): Record<TransportAction, string[]> {
  return {
    step: ['F10'],
    run: ['F8'],
    undo: apple ? ['⌘', 'Z'] : ['Ctrl', 'Z'],
    redo: apple ? ['⇧', '⌘', 'Z'] : ['Ctrl', 'Shift', 'Z']
  };
}

/** The same shortcuts in the form `aria-keyshortcuts` takes. */
export const TRANSPORT_ARIA_KEYS: Record<TransportAction, string> = {
  step: 'F10',
  run: 'F8',
  undo: 'Control+Z Meta+Z',
  redo: 'Control+Shift+Z Meta+Shift+Z Control+Y'
};
