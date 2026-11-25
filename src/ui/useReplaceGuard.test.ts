import { describe, expect, it, vi } from 'vitest';
import type { ProgramInstruction } from '@/core/shared/program';
import { useReplaceGuard } from './useReplaceGuard';

const line = (mnemonic: string): ProgramInstruction =>
  ({ mnemonic, operands: [] }) as ProgramInstruction;

describe('useReplaceGuard', () => {
  it('loads at once when nothing would be lost', () => {
    const { guard, pending } = useReplaceGuard();
    const proceed = vi.fn();
    guard([], [line('nop')], 'Example', proceed);
    guard([line('nop')], [line('nop')], 'Same', proceed);
    expect(proceed).toHaveBeenCalledTimes(2);
    expect(pending.value).toBeNull();
  });

  it('asks before another program takes the place of the learner’s, and loads on a yes', () => {
    const { guard, pending, confirm } = useReplaceGuard();
    const proceed = vi.fn();
    guard([line('inc'), line('dec')], [line('nop')], 'Sum 1..10', proceed);
    expect(proceed).not.toHaveBeenCalled();
    expect(pending.value).toMatchObject({ name: 'Sum 1..10', lines: 2 });
    confirm();
    expect(proceed).toHaveBeenCalledOnce();
    expect(pending.value).toBeNull();
  });

  it('keeps the program when the learner says no', () => {
    const { guard, pending, cancel } = useReplaceGuard();
    const proceed = vi.fn();
    guard([line('inc')], [line('nop')], 'Example', proceed);
    cancel();
    expect(proceed).not.toHaveBeenCalled();
    expect(pending.value).toBeNull();
  });
});
