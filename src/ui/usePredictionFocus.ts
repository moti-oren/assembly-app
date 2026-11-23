import { nextTick, watch, type Ref } from 'vue';

/** The run buttons of the transport bar, which TransportBar marks: where focus falls back to. */
const RUN_BUTTON = '[data-transport-run] button:not(:disabled)';

const shown = (element: HTMLElement | null): element is HTMLElement =>
  element !== null && element.isConnected && element.offsetParent !== null;

/**
 * Where the focus goes around a question of prediction mode. A question takes it, so it can be
 * answered from the keyboard that asked for the step; once answered its controls are gone, and
 * the focus they held goes back to where it came from, or to the run buttons.
 */
export function usePredictionFocus(
  bar: Readonly<Ref<HTMLElement | null>>,
  asking: () => unknown
): void {
  /** What held the focus when the question opened. */
  let opener: HTMLElement | null = null;

  watch(
    asking,
    async (question) => {
      const active = document.activeElement;
      const held = bar.value?.contains(active) ?? false;
      if (question && !held) opener = active instanceof HTMLElement ? active : null;
      await nextTick();
      if (question) {
        bar.value?.querySelector<HTMLElement>('input, button')?.focus();
      } else if (held && document.activeElement === document.body) {
        // Nothing else took the focus, as the builder does once its instruction has run.
        const run = document.querySelector<HTMLElement>(RUN_BUTTON);
        (shown(opener) ? opener : run)?.focus();
      }
    },
    { flush: 'pre' }
  );
}
