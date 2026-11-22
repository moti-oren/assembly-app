import { describe, expect, it } from 'vitest';
import { shortcutList } from './shortcutList';
import { transportKeys } from './transportKeys';

describe('shortcutList', () => {
  it('shows the transport shortcuts with the keys the transport bar shows', () => {
    const list = shortcutList(false);
    const keys = transportKeys(false);
    expect(list.find((each) => each.label === 'Step one line')?.keys).toEqual(keys.step);
    expect(list.find((each) => each.label === 'Undo the last step')?.keys).toEqual(keys.undo);
  });

  it('uses the Command key on an Apple keyboard', () => {
    const commands = (apple: boolean) =>
      shortcutList(apple).find((each) => each.label === 'Open the commands')?.keys;
    expect(commands(true)).toEqual(['⌘', 'K']);
    expect(commands(false)).toEqual(['Ctrl', 'K']);
  });

  it('names every shortcut once', () => {
    const labels = shortcutList(false).map((each) => each.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
