import { computed, type ComputedRef, type Ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { memoryColumns, type MemoryColumns } from './memoryColumns';

/** How many bytes a row holds in the memory table drawn inside `box`, for the room it has. */
export function useMemoryColumns(box: Ref<HTMLElement | null>): ComputedRef<MemoryColumns> {
  // Until the box is measured the window stands in for it, so a phone never draws sixteen first.
  const { width } = useElementSize(box, { width: window.innerWidth, height: 0 });
  return computed(() => memoryColumns(width.value));
}
