import { computed, nextTick, watchEffect } from 'vue';
import { createGlobalState, useDark, useLocalStorage, useMediaQuery } from '@vueuse/core';
import { isArchitectureId, type ArchitectureId } from './architectures';
import type { SoundKind } from './sounds';
import { STORAGE_KEYS } from './storageKeys';
import { playSound } from './synth';

type CpuView = 'diagram' | 'table';

/** What switching to each CPU view is called, on its button and in the command palette. */
export const CPU_VIEW_LABELS: Record<CpuView, string> = {
  diagram: 'Show the CPU as a diagram',
  table: 'Show the CPU as tables'
};

/** Theme, sound, view and motion, shared by the header and the command palette. All are remembered. */
export const usePreferences = createGlobalState(() => {
  /** Light until the user picks a theme. */
  const isDark = useDark({ initialValue: 'light' });
  const soundOn = useLocalStorage(STORAGE_KEYS.sound, false);
  /** The CPU's state as one wired diagram, or as the separate register and flag tables. */
  const cpuView = useLocalStorage<CpuView>(STORAGE_KEYS.cpuView, 'diagram', {
    // Anything else in storage (an old or hand-edited value) falls back to the diagram.
    serializer: { read: (raw) => (raw === 'table' ? 'table' : 'diagram'), write: (view) => view }
  });

  /** Whether the 8086 diagram spells each register out in bits, beside its hex and decimal. */
  const registerBits = useLocalStorage(STORAGE_KEYS.registerBits, false);

  /** The CPU on show. Each one keeps its own program and history while the other is shown. */
  const architecture = useLocalStorage<ArchitectureId>(STORAGE_KEYS.architecture, 'x86', {
    serializer: { read: (raw) => (isArchitectureId(raw) ? raw : 'x86'), write: (id) => id }
  });

  /** Asked for here; the system setting can ask for it too, and either one is enough. */
  const reduceMotion = useLocalStorage(STORAGE_KEYS.reduceMotion, false);
  const systemReducesMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  /** True when animations should be cut down, whoever asked. */
  const calm = computed(() => reduceMotion.value || systemReducesMotion.value);

  // The stylesheet reads this attribute rather than the media query, so both sources count.
  watchEffect(() => {
    if (calm.value) document.documentElement.dataset.motion = 'reduced';
    else delete document.documentElement.dataset.motion;
  });

  function toggleTheme(): void {
    const flip = async (): Promise<void> => {
      isDark.value = !isDark.value;
      await nextTick();
    };
    if (calm.value || !('startViewTransition' in document)) {
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

  return {
    isDark,
    soundOn,
    cpuView,
    registerBits,
    architecture,
    reduceMotion,
    systemReducesMotion,
    calm,
    toggleTheme,
    play
  };
});
