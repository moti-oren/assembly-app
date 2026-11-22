import { describe, expect, it } from 'vitest';
import {
  allowedFor,
  colourLiterals,
  family,
  namedColour,
  paletteClasses
} from './designPalette.mjs';

describe('the family of a colour', () => {
  it.each([
    ['#ffffff', 'neutral'],
    ['#0a0b0d', 'neutral'],
    ['#344054', 'neutral'],
    ['rgb(16 24 40 / 24%)', 'neutral'],
    ['#0066ff', 'blue'],
    ['rgb(59 130 246 / 14%)', 'blue'],
    ['#ea580c', 'orange'],
    ['#fff7ed', 'neutral'],
    ['#362218', 'orange'],
    ['#d92d20', 'red'],
    ['oklch(0.62 0.09 15)', 'pink'],
    ['#ec4899', 'pink'],
    ['oklch(0.6 0.09 295)', 'purple'],
    ['#10b981', 'green'],
    ['oklch(0.62 0.07 200)', 'teal'],
    ['#eab308', 'yellow'],
    ['#6b7a6b', 'tinted grey']
  ])('%s is %s', (colour, expected) => {
    expect(family(colour)).toBe(expected);
  });
});

describe('what a token may hold', () => {
  it('neutral, blue and orange are for any token', () => {
    expect(['neutral', 'blue', 'orange'].every((hue) => allowedFor('tag', hue))).toBe(true);
  });

  it('red is for an error only', () => {
    expect(allowedFor('destructive', 'red')).toBe(true);
    expect(allowedFor('tag', 'red')).toBe(false);
  });

  it.each(['pink', 'purple', 'green', 'teal', 'yellow', 'tinted grey'])('%s is foreign', (hue) => {
    expect(allowedFor('destructive', hue)).toBe(false);
  });
});

describe('colour words on a line', () => {
  it('finds a Tailwind palette class under any utility, and the theme variable', () => {
    expect(paletteClasses('class="bg-pink-500/20 inset-ring-rose-300 text-sm"')).toEqual([
      'bg-pink-500',
      'inset-ring-rose-300'
    ]);
    expect(paletteClasses('color: var(--color-teal-600);')).toEqual(['--color-teal-600']);
  });

  it('leaves our own classes alone', () => {
    expect(paletteClasses('class="bg-chart-1/25 text-pointer border-changed gap-2 z-50"')).toEqual(
      []
    );
  });

  it('finds a named CSS colour in a declaration', () => {
    expect(namedColour('  background: hotpink;')).toBe('hotpink');
    expect(namedColour('  border-left: 1px solid purple;')).toBe('purple');
    expect(namedColour('style="color: Teal"')).toBe('Teal');
  });

  it('does not take a word in a name or in text for a colour', () => {
    expect(namedColour('  color: var(--changed-foreground);')).toBeNull();
    expect(namedColour('  border-color: transparent;')).toBeNull();
    expect(namedColour('<p>The red wire: blue reads, orange writes</p>')).toBeNull();
    expect(namedColour('  white-space: nowrap;')).toBeNull();
  });

  it('lists every colour written on a line of the sheet', () => {
    expect(colourLiterals('--shadow: 0 1px #fff, 0 0 0 1px rgb(16 24 40 / 8%);')).toEqual([
      '#fff',
      'rgb(16 24 40 / 8%)'
    ]);
  });
});
