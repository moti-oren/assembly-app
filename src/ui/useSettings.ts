import { ref } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { SettingsSectionId } from './settingsSections';
import { useLazyOpen } from './useLazyOpen';

/** Whether the settings are open, and on which section; the header and the palette open them. */
export const useSettings = createGlobalState(() => {
  /** Kept while the page lives, so the settings open where they were left. */
  const section = ref<SettingsSectionId>('general');
  return { ...useLazyOpen(), section };
});
