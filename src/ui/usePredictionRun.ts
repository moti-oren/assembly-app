import { computed, ref } from 'vue';
import { tryOnScopeDispose } from '@vueuse/core';
import { MAX_STEPS } from '@/core/shared/program';
import { RUN_SPEEDS } from './runSpeeds';
import type { CpuControls } from './useCpu';
import { usePreferences } from './usePreferences';

/** What a run that stops to ask needs from prediction mode. */
export interface PredictionRunHooks {
  /** Asks about the next line; false when it has no question, and the run just steps it. */
  next: () => boolean;
  /** The run ended or was paused: a question it left open is void. */
  stopped: () => void;
}

/**
 * Run for prediction mode: line by line at the run speed, waiting at each line that has a
 * question. With the mode off for runs, or at Instant speed, Run is the CPU's own.
 */
export function usePredictionRun(cpu: CpuControls, hooks: PredictionRunHooks) {
  const { prediction, predictRun } = usePreferences();
  const asks = computed(
    () => prediction.value && predictRun.value && cpu.speed.value !== 'instant'
  );
  const stepping = ref(false);
  let timer: number | undefined;
  let steps = 0;

  function stop(): void {
    if (!stepping.value) return;
    stepping.value = false;
    window.clearTimeout(timer);
    hooks.stopped();
  }

  function later(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(advance, RUN_SPEEDS[cpu.speed.value]);
  }

  function advance(): void {
    if (!stepping.value) return;
    // A program that never ends is stopped where the CPU's own run would give up.
    if (cpu.finished.value || steps >= MAX_STEPS) return stop();
    if (hooks.next()) return;
    const before = cpu.history.value.length;
    cpu.stepProgram();
    steps += 1;
    if (cpu.history.value.length === before) return stop();
    later();
  }

  function runProgram(): void {
    // Run asked for again mid-run starts over, as the CPU's own run does: never two at once.
    stop();
    if (!asks.value) return cpu.runProgram();
    if (cpu.finished.value) return;
    steps = 0;
    stepping.value = true;
    advance();
  }

  /** The line that was asked about has run, or the CPU refused it: go on only if `goOn`. */
  function answered(goOn: boolean): void {
    steps += 1;
    if (goOn) later();
    else stop();
  }

  function pause(): void {
    stop();
    cpu.pause();
  }

  tryOnScopeDispose(stop);

  return {
    running: computed(() => stepping.value || cpu.running.value),
    runProgram,
    pause,
    stop,
    answered
  };
}
