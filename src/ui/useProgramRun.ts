import { onScopeDispose, ref, type Ref } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { RUN_SPEEDS, type RunSpeed } from './runSpeeds';

/** What a timed run has done so far. */
export interface RunProgress {
  steps: number;
  writes: number;
}

/** How the CPU runs program lines for the runner. */
export interface ProgramLines {
  /**
   * Runs the line at IP and returns its record, or null when the CPU stopped it with an error.
   * `progress` is how many steps and memory writes the run has made so far; both have a limit.
   */
  stepLine: (progress: RunProgress) => ExecutionRecord | null;
  /** Runs every remaining line at once. */
  runToEnd: () => void;
}

/** Runs the program line by line on a timer, at the chosen speed, until it ends or is paused. */
export function useProgramRun(finished: Readonly<Ref<boolean>>, lines: ProgramLines) {
  const speed = ref<RunSpeed>('normal');
  /** True while the program is running line by line on a timer. */
  const running = ref(false);
  let timer: number | undefined;
  /** Steps and memory writes of the run in progress, held to the limits of an instant run. */
  const progress: RunProgress = { steps: 0, writes: 0 };

  function pause(): void {
    running.value = false;
    window.clearTimeout(timer);
  }

  function runNextLine(): void {
    let continues = false;
    // Whatever goes wrong, even an error that is not the CPU's, the run must not stay "running".
    try {
      const entry = finished.value ? null : lines.stepLine(progress);
      if (entry) {
        progress.steps++;
        progress.writes += entry.memoryWrites.length;
      }
      continues = entry !== null && !finished.value;
    } finally {
      if (continues) {
        timer = window.setTimeout(runNextLine, RUN_SPEEDS[speed.value]);
      } else {
        pause();
      }
    }
  }

  function runProgram(): void {
    pause();
    if (speed.value === 'instant') {
      lines.runToEnd();
      return;
    }
    running.value = true;
    progress.steps = 0;
    progress.writes = 0;
    runNextLine();
  }

  onScopeDispose(pause);

  return { speed, running, pause, runProgram };
}
