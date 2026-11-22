import { ref, watch } from 'vue';

/** Whether a dialog is open, and whether it was ever wanted: its code loads only from then on. */
export function useLazyOpen() {
  const open = ref(false);
  const wanted = ref(false);
  watch(open, (isOpen) => {
    if (isOpen) wanted.value = true;
  });
  return { open, wanted };
}
