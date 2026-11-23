import { computed, nextTick, watch, watchEffect, type Ref } from 'vue';
import { createGlobalState, useColorMode, useLocalStorage, useMediaQuery } from '@vueuse/core';
import { analytics } from './analyticsClient';
import { isArchitectureId, type ArchitectureId } from './architectures';
import { modeForWidth } from './layoutMode';
import { isRunSpeed, type RunSpeed } from './runSpeeds';
import { STORAGE_KEYS } from './storageKeys';
import { sound } from './soundEngine';

type CpuView = 'diagram' | 'table';
/** The theme asked for; `auto` follows the device. */
export type Theme = 'light' | 'dark' | 'auto';

/** What switching to each CPU view is called, on its button and in the command palette. */
export const CPU_VIEW_LABELS: Record<CpuView, string> = {
  diagram: 'Show the CPU as a diagram',
  table: 'Show the CPU as tables'
};

/** Theme, sound, usage sharing, view, running, guessing and motion, shared by the settings and the command palette. All are remembered. */
export const usePreferences = createGlobalState(() => {
  /** Light until the user picks a theme. Light is the page without a class, dark the `dark` class. */
  const colorMode = useColorMode({
    storageKey: STORAGE_KEYS.theme,
    initialValue: 'light',
    modes: { light: '' }
  });
  /** The theme asked for, where `isDark` is the one on show. */
  const theme = colorMode.store as Ref<Theme>;
  const isDark = computed(() => colorMode.state.value === 'dark');
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

  /** How fast Run steps through a program, on every CPU. */
  const runSpeed = useLocalStorage<RunSpeed>(STORAGE_KEYS.runSpeed, 'normal', {
    serializer: { read: (raw) => (isRunSpeed(raw) ? raw : 'normal'), write: (speed) => speed }
  });
  /** Whether a program that uses a port opens the devices panel by itself. */
  const autoOpenDevices = useLocalStorage(STORAGE_KEYS.autoOpenDevices, true);
  /** Whether a reset that would lose the history asks first. */
  const confirmReset = useLocalStorage(STORAGE_KEYS.confirmReset, true);

  /** Whether an instruction asks what it will do before it runs. */
  const prediction = useLocalStorage(STORAGE_KEYS.prediction, false);
  /** Where it asks, while it is on: a program step, the builder's instruction, a run. */
  const predictStep = useLocalStorage(STORAGE_KEYS.predictStep, true);
  const predictBuilder = useLocalStorage(STORAGE_KEYS.predictBuilder, true);
  const predictRun = useLocalStorage(STORAGE_KEYS.predictRun, true);

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
  async function setTheme(next: Theme): Promise<void> {
    const root = document.documentElement;
    root.dataset.themeSwitch = '';
    theme.value = next;
    await nextTick();
    // Styles are worked out once with the new palette while transitions are still off.
    void document.body.offsetHeight;
    setTimeout(() => delete root.dataset.themeSwitch, 1);
  }

  /** To the other of light and dark, whatever the device asks for. */
  function toggleTheme(): Promise<void> {
    return setTheme(isDark.value ? 'light' : 'dark');
  }

  return {
    theme,
    isDark,
    soundOn,
    analyticsOn,
    cpuView,
    registerBits,
    architecture,
    runSpeed,
    autoOpenDevices,
    confirmReset,
    prediction,
    predictStep,
    predictBuilder,
    predictRun,
    reduceMotion,
    systemReducesMotion,
    calm,
    setTheme,
    toggleTheme
  };
});
