import { describe, expect, it } from 'vitest';
import { filterOptions, splitWord, typedNumberIn, type BuilderOption } from './builderGrammar';
import { builderOptions, type BuilderDraft } from './x86Grammar';

const empty: BuilderDraft = {
  prefix: null,
  mnemonic: null,
  operands: [],
  pendingMemory: null,
  typed: null,
  programLines: []
};

describe('filterOptions', () => {
  it('puts the options that start with the text first', () => {
    const options = builderOptions(empty);
    const filtered = filterOptions(options, 'mov', null).map((option) => option.label);
    expect(filtered.slice(0, 3)).toEqual(['mov', 'movsb', 'movsw']);
    const containing = filterOptions(options, 'sb', null).map((option) => option.label);
    expect(containing.slice(0, 2)).toEqual(['sbb', 'movsb']);
  });

  it('lets a typed number select only the options that accept it', () => {
    const options = builderOptions({ ...empty, mnemonic: 'jmp', programLines: ['nop', 'nop'] });
    expect(filterOptions(options, '1', 1).map((option) => option.label)).toEqual(['L1']);
  });
});

describe('typedNumberIn', () => {
  it('finds the number in an operand written around it', () => {
    expect(typedNumberIn('3')).toBe(3);
    expect(typedNumberIn('#$10')).toBe(0x10);
    expect(typedNumberIn('($10),y')).toBe(0x10);
    expect(typedNumberIn('$10,x')).toBe(0x10);
    expect(typedNumberIn('8(sp)')).toBe(8);
    expect(typedNumberIn('-4(a0)')).toBe(-4);
    expect(typedNumberIn('mov')).toBeNull();
  });

  it('puts the option written as typed first among those that take the number', () => {
    const option = (label: string): BuilderOption<string> => ({
      key: label,
      label,
      group: '',
      matchesNumber: () => true,
      action: label
    });
    const options = [option('$10'), option('#$10'), option('$10,x')];
    expect(filterOptions(options, '#$10', 0x10)[0].label).toBe('#$10');
    expect(filterOptions(options, '$10,X', 0x10)[0].label).toBe('$10,x');
  });
});

describe('splitWord', () => {
  const labels = ['mov', 'ax', '$10,x', '$10'];
  const goesOn = (text: string) => labels.some((label) => label.startsWith(text.toLowerCase()));

  it('ends a word at a space or a comma', () => {
    expect(splitWord('mov ax 3', goesOn)).toEqual({ word: 'mov', rest: 'ax 3' });
    expect(splitWord('ax, 3', goesOn)).toEqual({ word: 'ax', rest: '3' });
    expect(splitWord(' zero, 5', goesOn)).toEqual({ word: 'zero', rest: '5' });
  });

  it('keeps a comma that an option goes on past', () => {
    expect(splitWord('$10,', goesOn)).toBeNull();
    expect(splitWord('mov', goesOn)).toBeNull();
  });

  it('reads an offset and its register', () => {
    expect(splitWord('8(sp)', goesOn)).toEqual({ word: '8', rest: 'sp' });
  });
});
