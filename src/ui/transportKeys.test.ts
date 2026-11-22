import { describe, expect, it } from 'vitest';
import { transportAction, transportKeys, type KeyPress } from './transportKeys';

function press(key: string, modifiers: Partial<KeyPress> = {}): KeyPress {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  return {
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers
  };
}

describe('transportAction', () => {
  it('steps on F10 and runs on F8, also while typing', () => {
    expect(transportAction(press('F10'), false)).toBe('step');
    expect(transportAction(press('F8'), true)).toBe('run');
  });

  it('leaves a function key with a modifier to the browser', () => {
    expect(transportAction(press('F10', { shiftKey: true }), false)).toBeNull();
    expect(transportAction(press('F8', { ctrlKey: true }), false)).toBeNull();
  });

  it('undoes on Ctrl+Z or Cmd+Z', () => {
    expect(transportAction(press('z', { ctrlKey: true }), false)).toBe('undo');
    expect(transportAction(press('z', { metaKey: true }), false)).toBe('undo');
  });

  it('redoes on Ctrl+Shift+Z and Ctrl+Y', () => {
    expect(transportAction(press('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo');
    expect(transportAction(press('y', { ctrlKey: true }), false)).toBe('redo');
  });

  it('finds Z by its place on a layout without the letter', () => {
    expect(transportAction({ ...press('ז', { ctrlKey: true }), code: 'KeyZ' }, false)).toBe('undo');
  });

  it('leaves undo and redo to the text while typing', () => {
    expect(transportAction(press('z', { ctrlKey: true }), true)).toBeNull();
    expect(transportAction(press('y', { ctrlKey: true }), true)).toBeNull();
  });

  it('ignores other keys', () => {
    expect(transportAction(press('z'), false)).toBeNull();
    expect(transportAction(press('z', { ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(transportAction(press('k', { ctrlKey: true }), false)).toBeNull();
  });
});

describe('transportKeys', () => {
  it('names the modifier of the keyboard in use', () => {
    expect(transportKeys(false).undo).toEqual(['Ctrl', 'Z']);
    expect(transportKeys(true).redo).toEqual(['⇧', '⌘', 'Z']);
    expect(transportKeys(true).step).toEqual(['F10']);
  });
});
