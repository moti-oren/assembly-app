/** One entry in the command palette. */
export interface PaletteCommand {
  group: string;
  label: string;
  disabled?: boolean;
  /** The command's keyboard shortcut, one keycap per entry, when it has one. */
  keys?: string[];
  /**
   * What the command does to the page beyond its own state. Either way it runs once the palette
   * has closed, since an open palette locks page scrolling and then hands focus back. `focus`
   * also stops that hand-back, which would undo the command's work.
   */
  moves?: 'focus' | 'scroll';
  /** Other words someone might search for it by: `dark mode` for the theme. */
  keywords?: string;
  /** One of a set of choices, and the one in force: shown with a mark, not greyed out. */
  current?: boolean;
  run: () => void;
}

const SMALL_WORDS = /\b(the|a|an|to|of|on|in|for)\b/gi;

/**
 * What a search in the palette is matched against: the group, the label, the label without its
 * small words (so `show stack` finds "Show the stack") and the keywords.
 */
export function searchText({ group, label, keywords }: PaletteCommand): string {
  const plain = label.replace(SMALL_WORDS, ' ').replace(/\s+/g, ' ').trim();
  return [group, label, plain, keywords ?? ''].join(' ');
}
