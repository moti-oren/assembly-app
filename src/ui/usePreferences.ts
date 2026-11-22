import { computed, nextTick, watch, watchEffect } from 'vue';
import { createGlobalState, useDark, useLocalStorage, useMediaQuery } from '@vueuse/core';
import { analytics } from './analyticsClient';
import { isArchitectureId, type ArchitectureId } from './architectures';
import { modeForWidth } from './layoutMode';
import { STORAGE_KEYS } from './storageKeys';
import { sound } from './soundEngine';

type CpuView = 'diagram' | 'table';

/** What switching to each CPU view is called, on its button and in the command palette. */
export const CPU_VIEW_LABELS: Record<CpuView, string> = {
  diagram: 'Show the CPU as a diagram',
  table: 'Show the CPU as tables'
};

/** Theme, sound, usage sharing, view and motion, shared by the header and the command palette. All are remembered. */
export const usePreferences = createGlobalState(() => {
  /** Light until the user picks a theme. */
  const isDark = useDark({ initialValue: 'light' });
  const soundOn = useLocalStorage(STORAGE_KEYS.sound, false);
  watch(soundOn, sound.setEnabled, { immediate: true });
  /** Whether anonymous usage is counted; on until the user turns it off. */
  const analyticsOn = useLocalStorage(STORAGE_KEYS.analytics, true);
  watch(analyticsOn, analytics.setEnabled, { immediate: true });
  /**
   * The CPU's state as one wired diagram, or as the separate register and flag tables. A phone
   * starts on the tables, where the diagram would be a long column with its wires gone; the
   * choice made after that is the one remembered.
   */
  const firstView: CpuView = modeForWidth(window.innerWidth) === 'phone' ? 'table' : 'diagram';
  const cpuView = useLocalStorage<CpuView>(STORAGE_KEYS.cpuView, firstView, {
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

  /** Switches at once: transitions are held off for a frame, so no control fades through grey. */
  async function toggleTheme(): Promise<void> {
    const root = document.documentElement;
    root.dataset.themeSwitch = '';
    isDark.value = !isDark.value;
    await nextTick();
    // Styles are worked out once with the new palette while transitions are still off.
    void document.body.offsetHeight;
    setTimeout(() => delete root.dataset.themeSwitch, 1);
  }

  return {
    isDark,
    soundOn,
    analyticsOn,
    cpuView,
    registerBits,
    architecture,
    reduceMotion,
    systemReducesMotion,
    calm,
    toggleTheme
  };
});
