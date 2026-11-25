import { formatLabel } from '@/core/shared/program';
import type { PaletteCommand } from './paletteCommand';
import { lockNote } from './programLock';

/** The program as the palette's line commands see it, and what they do to it. */
export interface ProgramLines {
  /** The line that runs next: a line has no name the palette could ask for, so they act on it. */
  nextLine: number;
  length: number;
  /** Lines at the top given by a challenge. */
  locked: number;
  /** Line new instructions are inserted before; null = the end. */
  insertAt: number | null;
  finished: boolean;
  edit: (index: number) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  insertBefore: (index: number | null) => void;
}

/** The palette's commands on the line that runs next, and on where new lines go. */
export function programLineCommands(lines: ProgramLines): PaletteCommand[] {
  const { nextLine, length, locked, insertAt, finished } = lines;
  const group = 'Program';
  const name = formatLabel(nextLine);
  /** A command on the next line, named with why it is not on offer when a challenge locks it. */
  const onNextLine = (label: string, by: number): { label: string; disabled: boolean } => {
    const note = lockNote(nextLine, nextLine + by, locked);
    return { label: note ? `${label}: ${note}` : label, disabled: note !== null };
  };
  const onLine: PaletteCommand[] = finished
    ? []
    : [
        {
          group,
          ...onNextLine(`Edit the next line (${name})`, 0),
          moves: 'focus',
          run: () => lines.edit(nextLine)
        },
        {
          group,
          ...onNextLine(`Delete the next line (${name})`, 0),
          run: () => lines.remove(nextLine)
        },
        {
          group,
          ...onNextLine(`Add new lines above the next line (${name})`, 0),
          ...(insertAt === nextLine ? { disabled: true } : {}),
          run: () => lines.insertBefore(nextLine)
        },
        {
          group,
          ...onNextLine('Move the next line up', -1),
          ...(nextLine === 0 ? { disabled: true } : {}),
          run: () => lines.move(nextLine, nextLine - 1)
        },
        {
          group,
          ...onNextLine('Move the next line down', 1),
          ...(nextLine >= length - 1 ? { disabled: true } : {}),
          run: () => lines.move(nextLine, nextLine + 1)
        }
      ];
  // Only while new lines go above a chosen line; at the end is where they go otherwise.
  const atEnd: PaletteCommand[] =
    insertAt === null
      ? []
      : [{ group, label: 'Add new lines at the end', run: () => lines.insertBefore(null) }];
  return [...onLine, ...atEnd];
}
