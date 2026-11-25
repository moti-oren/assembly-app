import { nextTick, ref } from 'vue';
import { createGlobalState, useEventListener } from '@vueuse/core';
import type { PhoneView } from './layoutMode';
import { useLayoutMode } from './useLayoutMode';

/** Where Esc already means something else: a field being typed in, or an open menu or dialog. */
const ESCAPE_TAKEN = 'input, textarea, [role="dialog"], [role="menu"], [role="listbox"]';

/**
 * The part of the workbench a narrow screen shows: the view a phone is on, and whether a
 * tablet's sidebar is slid over the stage. Shared by every architecture, so switching CPU
 * keeps the page where it was.
 */
export const useWorkbenchView = createGlobalState(() => {
  const mode = useLayoutMode();
  /** A phone starts where a program is written; there is nothing to watch before that. */
  const view = ref<PhoneView>('code');
  const drawerOpen = ref(false);

  /** Brings a view in sight, whatever the layout: a desktop already shows them all. */
  function show(wanted: PhoneView): void {
    if (mode.value === 'phone') view.value = wanted;
    else if (mode.value === 'tablet' && wanted === 'code') drawerOpen.value = true;
  }

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || mode.value !== 'tablet' || !drawerOpen.value) return;
    if (event.target instanceof Element && event.target.closest(ESCAPE_TAKEN)) return;
    drawerOpen.value = false;
    // The drawer hides what had the focus: it goes back to the button that opens the drawer.
    void nextTick(() => document.querySelector<HTMLElement>('[data-drawer-toggle]')?.focus());
  });

  return { view, drawerOpen, show };
});
