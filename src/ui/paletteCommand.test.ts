import { describe, expect, it } from 'vitest';
import { searchText, type PaletteCommand } from './paletteCommand';

const command = (over: Partial<PaletteCommand>): PaletteCommand => ({
  group: 'CPU',
  label: 'Show the stack',
  run: () => {},
  ...over
});

describe('searchText', () => {
  it('finds a command by its group, and by its label without the small words', () => {
    const text = searchText(command({}));
    expect(text).toContain('CPU');
    expect(text).toContain('Show stack');
    expect(searchText(command({ group: 'Run speed', label: 'Fast' }))).toContain('speed');
  });

  it('finds a command by its keywords', () => {
    const theme = command({
      group: 'Preferences',
      label: 'Switch to dark theme',
      keywords: 'dark mode'
    });
    expect(searchText(theme)).toContain('dark mode');
  });
});
