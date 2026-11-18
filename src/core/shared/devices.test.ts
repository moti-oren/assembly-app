import { describe, expect, it } from 'vitest';
import { printable, terminalText } from './devices';

describe('printable', () => {
  it('shows printable ASCII as itself and anything else as a dot', () => {
    expect(printable(0x41)).toBe('A');
    expect(printable(0x20)).toBe(' ');
    expect(printable(0x7f)).toBe('·');
    expect(printable(0x0a)).toBe('·');
  });
});

describe('terminalText', () => {
  it('breaks lines on a line feed and drops carriage returns', () => {
    expect(terminalText([0x48, 0x0d, 0x0a, 0x49, 0x00])).toBe('H\nI·');
  });
});
