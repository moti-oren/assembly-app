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
  run: () => void;
}
