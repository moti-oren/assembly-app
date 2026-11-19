import { describe, expect, it } from 'vitest';
import { filterOptions } from './builderGrammar';
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
