import { ref } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { SettingsSectionId } from './settingsSections';
import { takeCleared } from './storedData';
import { useLazyOpen } from './useLazyOpen';

/** Whether the settings are open, and on which section; the header and the palette open them. */
export const useSettings = createGlobalState(() => {
  /** Kept while the page lives, so the settings open where they were left. */
  const section = ref<SettingsSectionId>('general');
  const lazy = useLazyOpen();
  /** The page was loaded by Clear everything: the settings open where it was, to say so. */
  const justCleared = ref(takeCleared(sessionStorage));
  if (justCleared.value) {
    section.value = 'data';
    lazy.open.value = true;
  }
  return { ...lazy, section, justCleared };
});
