import { describe, expect, it } from 'vitest';
import { END_OF_PROGRAM } from './builderGrammar';
import { X86 } from '@/core/x86/architecture';
import {
  builderOptions,
  overflowingSize,
  typingHint,
  X86_GRAMMAR,
  type BuilderDraft,
  type OptionAction
} from './x86Grammar';

const empty: BuilderDraft = {
  prefix: null,
  mnemonic: null,
  operands: [],
  pendingMemory: null,
  typed: null,
  programLines: []
};

const labels = (draft: Partial<BuilderDraft>) =>
  builderOptions({ ...empty, ...draft }).map((option) => option.label);

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
    expect(labels({ mnemonic: 'mov', operands: al, typed: 0x7f })).toContain('127');
    expect(labels({ mnemonic: 'mov', operands: al, typed: 0x100 })).not.toContain('0x100');
  });

  it('offers every program line as a jump target, and the end of the program', () => {
    const options = builderOptions({ ...empty, mnemonic: 'jmp', programLines: ['nop', 'nop'] });
    expect(options.map((option) => option.label)).toEqual(['L0', 'L1', 'L2']);
    expect(options[2].hint).toBe(END_OF_PROGRAM);
    expect(options[0].group).toBe('Jump to program line');
  });

  it('offers the base registers inside brackets, and a typed direct address first', () => {
    const options = builderOptions({ ...empty, mnemonic: 'mov', pendingMemory: 8, typed: 0x10 });
    expect(options.map((option) => option.label)).toEqual([
      '[0010h]',
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
    expect(typingHint(empty, '', false)).toBe('Type to filter instructions');
    expect(typingHint(draft({ prefix: 'rep' }), '', false)).toBe(
      'Pick the string instruction to repeat'
    );
  });

  it('asks for an address inside the brackets of a memory operand', () => {
    expect(typingHint(draft({ mnemonic: 'mov', pendingMemory: 16 }), '', false)).toBe(
      'Pick a register or type an offset (e.g. 10h)'
    );
  });

  it('says when a typed number is too big for the immediate', () => {
    const tooBig = draft({ mnemonic: 'mov', operands: [al], typed: 300 });
    expect(overflowingSize(tooBig)).toBe(8);
    expect(typingHint(tooBig, '300', false)).toBe('300 does not fit in 8 bits');
    expect(overflowingSize(draft({ mnemonic: 'mov', operands: [ax], typed: 300 }))).toBeNull();
  });

  it('explains how to type a number, a line, or that the instruction is ready', () => {
    expect(typingHint(draft({ mnemonic: 'mov', operands: [ax] }), '', false)).toMatch(
      /^Type a number/
    );
    expect(typingHint(draft({ mnemonic: 'jmp' }), '', false)).toBe(
      'Pick a line to jump to, or type its number'
    );
    expect(typingHint(draft({ mnemonic: 'nop' }), '', true)).toBe(
      'Enter: run now · Shift+Enter: add to the program'
    );
  });
});

describe('X86_GRAMMAR', () => {
  const context = { typed: null, programLines: [] };
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

  it('shows a typed immediate in its other base, with its size', () => {
    const hintOf = (typed: number) =>
      X86_GRAMMAR.options([mov, ax], { ...context, typed }).find((option) => option.key === 'imm')
        ?.hint;
    expect(hintOf(5)).toBe('= 0005h, 16-bit immediate');
    expect(hintOf(-5)).toBe('= 0FFFBh, 16-bit immediate');
    expect(hintOf(65)).toBe('= 0041h, 16-bit immediate');
  });

  it('works out its options from the words chosen so far', () => {
    const offered = X86_GRAMMAR.options([mov, ax], { ...context, typed: 5 });
    expect(offered.map((option) => option.label)).toContain('5');
  });

  it('describes the chosen mnemonic', () => {
    expect(X86_GRAMMAR.describe([])).toBeNull();
    expect(X86_GRAMMAR.describe([mov])).toEqual({ label: 'mov', text: 'dst = src' });
  });
});

describe('parse', () => {
  it('gives back the words of every line of the examples', () => {
    for (const example of X86.examples) {
      for (const instruction of example.program) {
        const words = X86_GRAMMAR.parse(instruction);
        expect(X86_GRAMMAR.build(words)).toEqual([instruction]);
        expect(X86_GRAMMAR.hasMore(words)).toBe(false);
      }
    }
  });
});

describe('operand order', () => {
  it('offers registers before program lines where a register is wanted', () => {
    const ax = { type: 'reg', name: 'ax' } as const;
    const after = labels({ mnemonic: 'mov', operands: [ax], programLines: ['nop', 'nop'] });
    expect(after[0]).not.toMatch(/^L\d/);
    expect(after.at(-1)).toMatch(/^L\d/);
    expect(labels({ mnemonic: 'jmp', programLines: ['nop'] })[0]).toBe('L0');
  });
});
