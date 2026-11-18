import { computed, ref, watch, type Ref } from 'vue';
import type { Instruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';

/** A program line that is being stepped one phase at a time and has not been executed yet. */
export interface PendingInstruction {
  phase: 'fetch' | 'decode';
  line: number;
  instruction: Instruction;
}

interface PhaseSteppingOptions {
  state: CpuState;
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
export function usePhaseStepping(options: PhaseSteppingOptions) {
  const { state, program, executed, finished, pause, stepProgram } = options;
  const phase = ref<PendingInstruction['phase'] | null>(null);

  const pending = computed<PendingInstruction | null>(() => {
    const line = state.registers.ip;
    const instruction = program.value[line];
    return phase.value && instruction ? { phase: phase.value, line, instruction } : null;
  });

  // Running an instruction, moving through history or editing the program starts the cycle over.
  watch(
    [executed, program, () => state.registers.ip],
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
