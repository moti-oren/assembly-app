import { describe, expect, it } from 'vitest';
import { DIRECTIONS, defaultLocale, isLocale, LOCALES, messagesFor } from './locale';

/** Every text in a messages object (a string, or a function of its values), by its path. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) =>
      leaves(inner, path ? `${path}.${key}` : key)
    );
  }
  return [[path, value]];
}

describe('isLocale', () => {
  it('accepts the supported languages only', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('he')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('defaultLocale', () => {
  it('follows the first supported language the browser prefers', () => {
    expect(defaultLocale(['he-IL', 'en-US'])).toBe('he');
    expect(defaultLocale(['fr-FR', 'en-GB', 'he'])).toBe('en');
    expect(defaultLocale(['iw'])).toBe('he');
  });

  it('falls back to English', () => {
    expect(defaultLocale(['fr', 'de'])).toBe('en');
    expect(defaultLocale([])).toBe('en');
  });
});

describe('messages', () => {
  it('give every language the same texts, none of them empty', () => {
    const paths = leaves(messagesFor('en')).map(([path]) => path);
    for (const locale of LOCALES) {
      const texts = leaves(messagesFor(locale));
      expect(texts.map(([path]) => path)).toEqual(paths);
      for (const [path, text] of texts) {
        expect(
          typeof text === 'function' || (typeof text === 'string' && text.trim() !== ''),
          path
        ).toBe(true);
      }
    }
  });
});

describe('Hebrew messages', () => {
  it('read right with the Latin words in them', () => {
    expect(messagesFor('he').x86Cycle.nextLine('L1')).toContain('ב-\u2060L1');
    expect(messagesFor('en').x86Cycle.nextLine('L1')).not.toMatch(/[\u200f\u2060]/);
  });
});

describe('DIRECTIONS', () => {
  it('names a direction for every language, Hebrew running right to left', () => {
    for (const locale of LOCALES) expect(['ltr', 'rtl']).toContain(DIRECTIONS[locale]);
    expect(DIRECTIONS.en).toBe('ltr');
    expect(DIRECTIONS.he).toBe('rtl');
  });
});
