import { nextTick } from 'vue';
import { createGlobalState, useDark, useLocalStorage } from '@vueuse/core';
import type { SoundKind } from './sounds';
import { playSound } from './synth';

/** Theme and sound, shared by the header and the command palette. Both are remembered. */
export const usePreferences = createGlobalState(() => {
  /** Dark until the user picks a theme. */
  const isDark = useDark({ initialValue: 'dark' });
  const soundOn = useLocalStorage('8086-sound', false);
  /** The CPU's state as one wired diagram, or as the separate register and flag tables. */
  const cpuView = useLocalStorage<'diagram' | 'table'>('8086-cpu-view', 'diagram');

  function toggleTheme(): void {
    const flip = async (): Promise<void> => {
      isDark.value = !isDark.value;
      await nextTick();
    };
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !('startViewTransition' in document)) {
      void flip();
    } else {
      // Cross-fades the whole page instead of snapping between the two palettes.
      document.startViewTransition(flip);
    }
  }

  /** Does nothing while sound is off. */
  function play(kind: SoundKind, delay = 0): void {
    if (soundOn.value) playSound(kind, delay);
  }

  return { isDark, soundOn, cpuView, toggleTheme, play };
});
