import { nextTick } from 'vue';
import { createGlobalState, useDark, useLocalStorage } from '@vueuse/core';

/** Theme and sound, shared by the header and the command palette. Both are remembered. */
export const usePreferences = createGlobalState(() => {
  /** Dark until the user picks a theme. */
  const isDark = useDark({ initialValue: 'dark' });
  const soundOn = useLocalStorage('8086-sound', false);

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

  let audio: AudioContext | undefined;

  /** A short, quiet tick. Does nothing while sound is off. */
  function tick(frequency: number): void {
    if (!soundOn.value) return;
    audio ??= new AudioContext();
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.07);
  }

  return { isDark, soundOn, toggleTheme, tick };
});
