import { computed, type ComputedRef } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { CpuState } from '@/core/shared/state';
import type { StackView } from './stackView';
import { followHistory, newWriters, type StackWriters } from './stackWriters';

/** An architecture's stack, read from its state and the instructions that ran. */
export type StackOf<State, Record> = (
  state: State,
  history: readonly Record[],
  writers: StackWriters
) => StackView;

/**
 * The stack of a CPU as its panel shows it. It is worked out only while something reads it, and
 * follows the history a record at a time.
 */
export function useStack<State extends CpuState, Record extends ExecutionRecord>(
  cpu: { state: State; history: { readonly value: readonly Record[] } },
  stackOf: StackOf<State, Record>
): ComputedRef<StackView> {
  // A cache, brought up to the history each time the view is worked out; nothing else reads it.
  const writers = newWriters();
  return computed(() => {
    // The bytes of memory are not reactive: its version says when they changed.
    void cpu.state.memoryVersion;
    followHistory(writers, cpu.history.value);
    return stackOf(cpu.state, cpu.history.value, writers);
  });
}
