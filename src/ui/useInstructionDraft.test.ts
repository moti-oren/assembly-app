import { describe, expect, it } from 'vitest';
import { useInstructionDraft } from './useInstructionDraft';

const labels = (draft: ReturnType<typeof useInstructionDraft>) =>
  draft.tokens.value.map((token) => token.label);

describe('useInstructionDraft', () => {
  it('builds an instruction word by word', () => {
    const draft = useInstructionDraft();
    draft.apply({ kind: 'mnemonic', mnemonic: 'mov' });
    draft.apply({ kind: 'operand', operand: { type: 'reg', name: 'ax' } });
    expect(draft.complete.value).toBe(false);
    expect(draft.built.value).toBeNull();

    draft.apply({ kind: 'operand', operand: { type: 'imm', value: 5 } });
    expect(draft.built.value).toEqual({
      mnemonic: 'mov',
      operands: [
        { type: 'reg', name: 'ax' },
        { type: 'imm', value: 5 }
      ]
    });
    expect(labels(draft)).toEqual(['mov', 'ax', '5']);
  });

  it('shows a memory operand as pending until its address is chosen', () => {
    const draft = useInstructionDraft();
    draft.apply({ kind: 'mnemonic', mnemonic: 'inc' });
    draft.apply({ kind: 'memory', size: 8 });
    expect(draft.tokens.value.at(-1)).toEqual({ label: 'byte [ ? ]', pending: true });
    expect(draft.complete.value).toBe(false);

    draft.apply({
      kind: 'operand',
      operand: { type: 'mem', size: 8, base: 'bx', displacement: 0 }
    });
    expect(draft.pendingMemory.value).toBeNull();
    expect(draft.complete.value).toBe(true);
  });

  it('carries the prefix into the built instruction', () => {
    const draft = useInstructionDraft();
    draft.apply({ kind: 'prefix', prefix: 'rep' });
    draft.apply({ kind: 'mnemonic', mnemonic: 'movsb' });
    expect(draft.built.value).toEqual({ prefix: 'rep', mnemonic: 'movsb', operands: [] });
  });

  it('truncates at a token, counting the prefix as one', () => {
    const draft = useInstructionDraft();
    draft.apply({ kind: 'mnemonic', mnemonic: 'add' });
    draft.apply({ kind: 'operand', operand: { type: 'reg', name: 'ax' } });
    draft.apply({ kind: 'operand', operand: { type: 'reg', name: 'bx' } });
    draft.truncateTo(2);
    expect(labels(draft)).toEqual(['add', 'ax']);

    const prefixed = useInstructionDraft();
    prefixed.apply({ kind: 'prefix', prefix: 'rep' });
    prefixed.apply({ kind: 'mnemonic', mnemonic: 'stosb' });
    prefixed.truncateTo(1);
    expect(labels(prefixed)).toEqual(['rep']);
    prefixed.truncateTo(0);
    expect(labels(prefixed)).toEqual([]);
  });
});
