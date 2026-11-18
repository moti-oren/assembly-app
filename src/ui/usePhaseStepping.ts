import { computed, ref, watch, type Ref } from 'vue';

/** A program line that is being stepped one phase at a time and has not been executed yet. */
export interface PendingInstruction<Instruction> {
  phase: 'fetch' | 'decode';
  line: number;
  instruction: Instruction;
}

interface PhaseSteppingOptions<Instruction> {
  /** The program line the instruction pointer points at. */
  nextLine: Readonly<Ref<number>>;
  program: Readonly<Ref<Instruction[]>>;
  /** How many instructions have run; any change starts the cycle over. */
  executed: () => number;
  finished: Readonly<Ref<boolean>>;
  pause: () => void;
  /** Executes the line at IP: the last of the three phases. */
  stepProgram: () => void;
}

/**
 * Steps the line at IP through fetch, decode and execute. Fetch and decode only show what is
 * about to happen: the CPU itself changes at execute, exactly as with a whole step.
 */
export function usePhaseStepping<Instruction>(options: PhaseSteppingOptions<Instruction>) {
  const { nextLine, program, executed, finished, pause, stepProgram } = options;
  const phase = ref<PendingInstruction<Instruction>['phase'] | null>(null);

  const pending = computed<PendingInstruction<Instruction> | null>(() => {
    const line = nextLine.value;
    const instruction = program.value[line];
    return phase.value && instruction ? { phase: phase.value, line, instruction } : null;
  });

  // Running an instruction, moving through history or editing the program starts the cycle over.
  watch(
    [executed, program, nextLine],
    () => {
      phase.value = null;
    },
    { flush: 'sync' }
  );

  /** Moves the line at IP one phase on: fetch, decode, then execute, which really runs it. */
  function stepPhase(): void {
    pause();
    if (finished.value) return;
    if (phase.value === null) {
      phase.value = 'fetch';
    } else if (phase.value === 'fetch') {
      phase.value = 'decode';
    } else {
      stepProgram();
    }
  }

  return { pending, stepPhase };
}
