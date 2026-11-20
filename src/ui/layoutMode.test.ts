import { describe, expect, it } from 'vitest';
import { modeFor, modeForWidth } from './layoutMode';

describe('modeForWidth', () => {
  it('is a phone below 768 pixels', () => {
    expect(modeForWidth(360)).toBe('phone');
    expect(modeForWidth(767)).toBe('phone');
  });

  it('is a tablet from 768 pixels up to 1024', () => {
    expect(modeForWidth(768)).toBe('tablet');
    expect(modeForWidth(1023)).toBe('tablet');
  });

  it('is a desktop from 1024 pixels', () => {
    expect(modeForWidth(1024)).toBe('desktop');
    expect(modeForWidth(1920)).toBe('desktop');
  });

  it('follows the size of the root font, as the media queries do', () => {
    expect(modeForWidth(1024, 20)).toBe('tablet');
  });
});

describe('modeFor', () => {
  it('names the mode two media queries describe', () => {
    expect(modeFor(false, false)).toBe('phone');
    expect(modeFor(true, false)).toBe('tablet');
    expect(modeFor(true, true)).toBe('desktop');
  });
});
