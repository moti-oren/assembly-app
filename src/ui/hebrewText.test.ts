import { describe, expect, it } from 'vitest';
import { hebrewText, mapTexts } from './hebrewText';

describe('hebrewText', () => {
  it('keeps a hyphenated prefix on the line of the word after it', () => {
    expect(hebrewText('IP ב-L1')).toBe('IP ב-\u2060L1');
  });

  it('marks a hyphen only once, however often it passes through', () => {
    expect(hebrewText(hebrewText('ב-L1'))).toBe('ב-\u2060L1');
  });

  it('separates clauses and list items so they keep their order', () => {
    expect(hebrewText('את CX. IP')).toBe('את CX.\u200f IP');
    expect(hebrewText('\u05d0\u05ea AX, BX')).toBe('\u05d0\u05ea AX,\u200f BX');
    expect(hebrewText(hebrewText('\u05d0\u05ea AX, BX'))).toBe('\u05d0\u05ea AX,\u200f BX');
  });

  it('leaves code set apart in an isolate as it is written', () => {
    const code = '\u2066bne t0, zero, L2\u2069';
    expect(hebrewText(`ב-${code}, אז`)).toBe(`ב-\u2060${code},\u200f אז`);
  });

  it('leaves text without a Hebrew letter as it is', () => {
    expect(hebrewText('MOV r16, imm16: ADD r16, r/m16')).toBe('MOV r16, imm16: ADD r16, r/m16');
  });

  it('leaves numbers and words without a space after the punctuation alone', () => {
    expect(hebrewText('1.5 a,b')).toBe('1.5 a,b');
  });
});

describe('mapTexts', () => {
  it('fixes every text, and what every function returns', () => {
    const fixed = mapTexts({ a: 'x', b: { c: (n: number) => `y${n}` } }, (text) => `[${text}]`);
    expect(fixed.a).toBe('[x]');
    expect(fixed.b.c(1)).toBe('[y1]');
  });
});
