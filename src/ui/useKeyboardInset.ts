import { useEventListener } from '@vueuse/core';

/** An on-screen keyboard takes at least this much of the window's height, in pixels. */
const KEYBOARD_HEIGHT = 150;

/**
 * Follows the on-screen keyboard of a touch screen. While it is up, the shell is as tall as
 * the part of the window left above it (--app-height) and the root carries `data-keyboard`,
 * which the style sheets use to put away what is not needed while typing.
 */
export function useKeyboardInset(): void {
  const viewport = window.visualViewport;
  if (!viewport || !window.matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  /** The tallest the visible window has been at this width: its height with no keyboard. */
  let full = viewport.height;
  let width = viewport.width;

  useEventListener(viewport, 'resize', () => {
    // A new width is a turned screen, not a keyboard: the full height starts over.
    if (viewport.width !== width) {
      width = viewport.width;
      full = viewport.height;
    }
    full = Math.max(full, viewport.height);
    if (full - viewport.height > KEYBOARD_HEIGHT) {
      root.style.setProperty('--app-height', `${viewport.height}px`);
      root.dataset.keyboard = '';
    } else {
      root.style.removeProperty('--app-height');
      delete root.dataset.keyboard;
    }
  });
}
