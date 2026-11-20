import { computed } from 'vue';
import { createSharedComposable, useMediaQuery } from '@vueuse/core';
import { DESKTOP_QUERY, modeFor, TABLET_QUERY } from './layoutMode';

/** Whether the window is laid out as a phone, a tablet or a desktop; see layoutMode.ts. */
export const useLayoutMode = createSharedComposable(() => {
  const tablet = useMediaQuery(TABLET_QUERY);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return computed(() => modeFor(tablet.value, desktop.value));
});
