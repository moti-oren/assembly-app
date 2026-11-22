import { transportKeys } from './transportKeys';

/** A keyboard shortcut as the settings list it: what it does, and one keycap per key. */
export interface Shortcut {
  label: string;
  keys: string[];
  /** Where it works, when that is not everywhere. */
  where?: string;
}

/** The app's keyboard shortcuts, with the modifier of an Apple keyboard or of any other. */
export function shortcutList(apple: boolean): Shortcut[] {
  const transport = transportKeys(apple);
  return [
    { label: 'Step one line', keys: transport.step },
    { label: 'Run or pause the program', keys: transport.run },
    { label: 'Undo the last step', keys: transport.undo },
    { label: 'Redo it', keys: transport.redo },
    { label: 'Open the commands', keys: apple ? ['⌘', 'K'] : ['Ctrl', 'K'] },
    { label: 'Run the instruction', keys: ['Enter'], where: 'In the instruction builder' },
    {
      label: 'Add the instruction to the program',
      keys: ['Shift', 'Enter'],
      where: 'In the instruction builder'
    },
    { label: 'Move a panel', keys: ['Alt', '↑ ↓'], where: "On a sidebar panel's handle" }
  ];
}
