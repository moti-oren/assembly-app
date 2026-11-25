import { describe, expect, it, vi } from 'vitest';
import { programLineCommands, type ProgramLines } from './programLineCommands';

function linesOf(changes: Partial<ProgramLines> = {}): ProgramLines {
  return {
    nextLine: 1,
    length: 3,
    locked: 0,
    insertAt: null,
    finished: false,
    edit: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    insertBefore: vi.fn(),
    ...changes
  };
}

const labelled = (lines: ProgramLines, start: string) =>
  programLineCommands(lines).find((command) => command.label.startsWith(start));

describe('programLineCommands', () => {
  it('deletes the next line and adds new lines above it', () => {
    const lines = linesOf();
    labelled(lines, 'Delete the next line (L1)')?.run();
    expect(lines.remove).toHaveBeenCalledWith(1);
    labelled(lines, 'Add new lines above the next line (L1)')?.run();
    expect(lines.insertBefore).toHaveBeenCalledWith(1);
  });

  it('does not offer to add lines where they already go, and offers the end instead', () => {
    const lines = linesOf({ insertAt: 1 });
    expect(labelled(lines, 'Add new lines above')?.disabled).toBe(true);
    labelled(lines, 'Add new lines at the end')?.run();
    expect(lines.insertBefore).toHaveBeenCalledWith(null);
  });

  it('keeps the first line from moving up without blaming a challenge', () => {
    const up = labelled(linesOf({ nextLine: 0 }), 'Move the next line up');
    expect(up).toMatchObject({ label: 'Move the next line up', disabled: true });
  });

  it('says a line given by a challenge cannot be deleted', () => {
    const remove = labelled(linesOf({ nextLine: 0, locked: 1 }), 'Delete the next line');
    expect(remove).toMatchObject({ disabled: true });
    expect(remove?.label).toMatch(/given by the challenge/);
  });

  it('offers nothing on a line once the program has finished', () => {
    expect(programLineCommands(linesOf({ finished: true }))).toEqual([]);
  });
});
