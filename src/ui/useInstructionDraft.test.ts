import { describe, expect, it } from 'vitest';
import { useInstructionDraft } from './useInstructionDraft';
import { X86_GRAMMAR } from './x86Grammar';

const draftOf = () => useInstructionDraft(X86_GRAMMAR);
const labels = (draft: ReturnType<typeof draftOf>) =>
  draft.tokens.value.map((token) => token.label);

describe('useInstructionDraft', () => {
  it('builds an instruction word by word', () => {
    const draft = draftOf();
    draft.apply({ kind: 'mnemonic', mnemonic: 'mov' });
    draft.apply({ kind: 'operand', operand: { type: 'reg', name: 'ax' } });
    expect(draft.complete.value).toBe(false);
    expect(draft.built.value).toBeNull();

    draft.apply({ kind: 'operand', operand: { type: 'imm', value: 5 } });
    expect(draft.built.value).toEqual([
      {
        mnemonic: 'mov',
        operands: [
          { type: 'reg', name: 'ax' },
          { type: 'imm', value: 5 }
        ]
      }
    ]);
    expect(labels(draft)).toEqual(['mov', 'ax', '5']);
  });

  it('shows a memory operand as pending until its address is chosen', () => {
    const draft = draftOf();
    draft.apply({ kind: 'mnemonic', mnemonic: 'inc' });
    draft.apply({ kind: 'memory', size: 8 });
    expect(draft.tokens.value.at(-1)).toEqual({ label: 'byte [ ? ]', pending: true, keep: 1 });
    expect(draft.complete.value).toBe(false);

    draft.apply({
      kind: 'operand',
      operand: { type: 'mem', size: 8, base: 'bx', displacement: 0 }
    });
    expect(labels(draft)).toEqual(['inc', 'byte [bx]']);
    expect(draft.complete.value).toBe(true);
  });

  it('removes the size and the address of a memory operand together', () => {
    const draft = draftOf();
    draft.apply({ kind: 'mnemonic', mnemonic: 'inc' });
    draft.apply({ kind: 'memory', size: 8 });
    draft.apply({
      kind: 'operand',
      operand: { type: 'mem', size: 8, base: 'bx', displacement: 0 }
    });
    draft.truncateTo(1);
    expect(draft.chosen.value).toEqual([{ kind: 'mnemonic', mnemonic: 'inc' }]);
  });

  it('carries the prefix into the built instruction', () => {
    const draft = draftOf();
    draft.apply({ kind: 'prefix', prefix: 'rep' });
    draft.apply({ kind: 'mnemonic', mnemonic: 'movsb' });
    expect(draft.built.value).toEqual([{ prefix: 'rep', mnemonic: 'movsb', operands: [] }]);
  });

  it('truncates at a token, counting the prefix as one', () => {
    const draft = draftOf();
    draft.apply({ kind: 'mnemonic', mnemonic: 'add' });
    draft.apply({ kind: 'operand', operand: { type: 'reg', name: 'ax' } });
    draft.apply({ kind: 'operand', operand: { type: 'reg', name: 'bx' } });
    draft.truncateTo(2);
    expect(labels(draft)).toEqual(['add', 'ax']);

    const prefixed = draftOf();
    prefixed.apply({ kind: 'prefix', prefix: 'rep' });
    prefixed.apply({ kind: 'mnemonic', mnemonic: 'stosb' });
    prefixed.truncateTo(1);
    expect(labels(prefixed)).toEqual(['rep']);
    prefixed.truncateTo(0);
    expect(labels(prefixed)).toEqual([]);
  });
});
