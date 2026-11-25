import { nextTick, ref } from 'vue';
import { createGlobalState, useEventListener } from '@vueuse/core';
import type { PhoneView } from './layoutMode';
import { useLayoutMode } from './useLayoutMode';

/** Where Esc already means something else: an open menu or dialog, or a longer text. */
const ESCAPE_TAKEN =
  'textarea, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** The fields text is typed into, where Esc may be the field's own while it holds some. */
const TEXT_INPUTS = new Set(['text', 'search', 'number', 'url', 'email', 'tel', 'password']);

/**
 * Whether Esc is the drawer's: not used by what had it (the builder clearing what it held marks
 * the key as used), and not in a field still holding text, where Esc may be the field's own.
 */
function escapeIsFree(event: KeyboardEvent): boolean {
  const { target } = event;
  if (event.defaultPrevented) return false;
  if (!(target instanceof Element)) return true;
  if (target.closest(ESCAPE_TAKEN)) return false;
  return (
    !(target instanceof HTMLInputElement) || !TEXT_INPUTS.has(target.type) || target.value === ''
  );
}

/**
 * The part of the workbench a narrow screen shows: the view a phone is on, and whether a
 * tablet's sidebar is slid over the stage. Shared by every architecture, so switching CPU
 * keeps the page where it was.
 */
function focusToggle(): void {
  document.querySelector<HTMLElement>('[data-drawer-toggle]')?.focus();
}

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
    if (!escapeIsFree(event)) return;
    drawerOpen.value = false;
    // The drawer hides what had the focus: it goes back to the button that opens the drawer.
    void nextTick(focusToggle);
  });

  // A press on the stage beside the drawer closes it, as a drawer does; its own button toggles it.
  useEventListener(window, 'pointerdown', (event: PointerEvent) => {
    if (mode.value !== 'tablet' || !drawerOpen.value || !(event.target instanceof Element)) return;
    if (!event.target.closest('[data-pane="stage"]')) return;
    drawerOpen.value = false;
    // Once the press has given the focus to what it landed on, a focus still in the closed
    // drawer (or lost with it) goes to the drawer's button instead.
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.closest('[data-pane="sidebar"]')) {
        focusToggle();
      }
    });
  });

  return { view, drawerOpen, show };
});
