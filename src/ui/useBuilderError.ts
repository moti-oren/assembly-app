import { computed, ref, watch, type WatchSource } from 'vue';

/**
 * The builder's error while it is still about what is in the box: it shows when the CPU raises
 * it, and goes once another instruction is being written (any of `edits` changes).
 */
export function useBuilderError(error: () => string | null, edits: WatchSource[]) {
  const dismissed = ref(false);
  watch(error, () => {
    dismissed.value = false;
  });
  watch(edits, () => {
    if (error()) dismissed.value = true;
  });
  return computed(() => (dismissed.value ? null : error()));
}
