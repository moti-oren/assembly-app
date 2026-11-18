import { ref, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';

/** Whether the comparison of the three CPUs is open; the header and the palette both open it. */
export const useComparison = createGlobalState(() => {
  const open = ref(false);
  /** Turns true the first time it opens, so the comparison's code loads only when it is wanted. */
  const wanted = ref(false);
  watch(open, (isOpen) => {
    if (isOpen) wanted.value = true;
  });
  return { open, wanted };
});
