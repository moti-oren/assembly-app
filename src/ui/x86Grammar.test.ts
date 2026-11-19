import { describe, expect, it } from 'vitest';
import {
  builderOptions,
  overflowingSize,
  typingHint,
  X86_GRAMMAR,
  type BuilderDraft,
  type OptionAction
} from './x86Grammar';
import { messagesFor } from './locale';

const m = messagesFor('en');

const empty: BuilderDraft = {
  prefix: null,
  mnemonic: null,
  operands: [],
  pendingMemory: null,
  typed: null,
  programLines: []
};

const labels = (draft: Partial<BuilderDraft>) =>
  builderOptions(m, { ...empty, ...draft }).map((option) => option.label);

describe('builderOptions', () => {
  it('offers the repeat prefixes right after the string instructions', () => {
    const offered = labels({});
    const prefixes = offered.indexOf('rep');
    expect(offered[prefixes - 1]).toBe('cmpsw');
    expect(offered.slice(prefixes, prefixes + 3)).toEqual(['rep', 'repe', 'repne']);
  });

  it('narrows the mnemonics to the ones a chosen prefix fits', () => {
    expect(labels({ prefix: 'rep' })).toEqual([
      'movsb',
      'movsw',
      'stosb',
      'stosw',
      'lodsb',
      'lodsw'
    ]);
    expect(labels({ prefix: 'repne' })).toEqual(['scasb', 'scasw', 'cmpsb', 'cmpsw']);
  });

  it('offers a typed immediate only when it fits the operand', () => {
    const al = [{ type: 'reg', name: 'al' } as const];
    expect(labels({ mnemonic: 'mov', operands: al, typed: 0x7f })).toContain('0x7F');
    expect(labels({ mnemonic: 'mov', operands: al, typed: 0x100 })).not.toContain('0x100');
  });

  it('offers every program line as a jump target, and the end of the program', () => {
    const options = builderOptions(m, { ...empty, mnemonic: 'jmp', programLines: ['nop', 'nop'] });
    expect(options.map((option) => option.label)).toEqual(['L0', 'L1', 'L2']);
    expect(options[2].hint).toBe('end of program');
    expect(options[0].group).toBe('Jump to program line');
  });

  it('offers the base registers inside brackets, and a typed direct address first', () => {
    const options = builderOptions(m, { ...empty, mnemonic: 'mov', pendingMemory: 8, typed: 0x10 });
    expect(options.map((option) => option.label)).toEqual([
      '[0x0010]',
      '[bx]',
      '[si]',
      '[di]',
      '[bp]'
    ]);
    expect(options[0].action).toEqual({
      kind: 'operand',
      operand: { type: 'mem', size: 8, base: null, displacement: 0x10 }
    });
    expect(options[4].hint).toBe('SS:BP');
  });
});

describe('typingHint', () => {
  const draft = (changes: Partial<BuilderDraft>): BuilderDraft => ({ ...empty, ...changes });
  const ax = { type: 'reg', name: 'ax' } as const;
  const al = { type: 'reg', name: 'al' } as const;

  it('asks for an instruction first, or the one a prefix repeats', () => {
    expect(typingHint(m, empty, '', false)).toBe('Type to filter instructions');
    expect(typingHint(m, draft({ prefix: 'rep' }), '', false)).toBe(
      'Pick the string instruction to repeat'
    );
  });

  it('asks for an address inside the brackets of a memory operand', () => {
    expect(typingHint(m, draft({ mnemonic: 'mov', pendingMemory: 16 }), '', false)).toBe(
      'Pick a register or type an offset (e.g. 0x10)'
    );
  });

  it('says when a typed number is too big for the immediate', () => {
    const tooBig = draft({ mnemonic: 'mov', operands: [al], typed: 300 });
    expect(overflowingSize(tooBig)).toBe(8);
    expect(typingHint(m, tooBig, '300', false)).toBe('300 does not fit in 8 bits');
    expect(overflowingSize(draft({ mnemonic: 'mov', operands: [ax], typed: 300 }))).toBeNull();
  });

  it('explains how to type a number, a line, or that the instruction is ready', () => {
    expect(typingHint(m, draft({ mnemonic: 'mov', operands: [ax] }), '', false)).toMatch(
      /^Type a number/
    );
    expect(typingHint(m, draft({ mnemonic: 'jmp' }), '', false)).toBe(
      'Pick a line to jump to, or type its number'
    );
    expect(typingHint(m, draft({ mnemonic: 'nop' }), '', true)).toBe(
      'Enter: run now · Shift+Enter: add to the program'
    );
  });
});

describe('X86_GRAMMAR', () => {
  const context = { typed: null, programLines: [], messages: m };
  const mov: OptionAction = { kind: 'mnemonic', mnemonic: 'mov' };
  const ax: OptionAction = { kind: 'operand', operand: { type: 'reg', name: 'ax' } };

  it('builds one instruction once every operand is chosen', () => {
    expect(X86_GRAMMAR.build([mov, ax])).toBeNull();
    expect(X86_GRAMMAR.hasMore([mov, ax])).toBe(true);
    const five: OptionAction = { kind: 'operand', operand: { type: 'imm', value: 5 } };
    expect(X86_GRAMMAR.build([mov, ax, five])).toEqual([
      {
        mnemonic: 'mov',
        operands: [
          { type: 'reg', name: 'ax' },
          { type: 'imm', value: 5 }
        ]
      }
    ]);
    expect(X86_GRAMMAR.hasMore([mov, ax, five])).toBe(false);
  });

  it('works out its options from the words chosen so far', () => {
    const offered = X86_GRAMMAR.options([mov, ax], { ...context, typed: 5 });
    expect(offered.map((option) => option.label)).toContain('5');
  });

  it('describes the chosen mnemonic', () => {
    expect(X86_GRAMMAR.describe([], m)).toBeNull();
    expect(X86_GRAMMAR.describe([mov], m)).toEqual({ label: 'mov', text: 'dst = src' });
  });
});
