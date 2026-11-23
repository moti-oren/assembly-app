import { computed, ref, watch } from 'vue';
import { hasControl, solveControl, type ControlLink, type ControlView } from '@/core/controlLink';
import { solvePc } from '@/core/logic/programCounter';
import type { ClockPhase } from '@/core/logic/register';
import { RV32_CONTROL } from '@/core/rv32Control';
import { STARTING_WORD, withBitFlipped, wordFields } from './controlView';
import { NEXT_PHASE } from './storageView';

/**
 * The instruction word on show in the control topic: the one the CPU ran last, or the learner's
 * own once they change a bit. The CPU is never touched.
 */
export function useControlLens(link: () => ControlLink | null) {
  /** What the control unit made of the CPU's last instruction, when it has one to show. */
  const fromCpu = computed<ControlView | null>(() => {
    const given = link();
    return given && hasControl(given) ? given : null;
  });
  /** The learner's own word, once they have changed a bit. */
  const edited = ref<number | null>(null);
  const phase = ref<ClockPhase>('before');
  // A new moment of the CPU is shown as it happened, not with an old "what if" over it.
  watch(fromCpu, () => {
    edited.value = null;
    phase.value = 'before';
  });

  // RISC-V's is the one control unit there is to try by hand.
  const shape = computed(() => fromCpu.value?.shape ?? RV32_CONTROL);
  const word = computed(() => edited.value ?? fromCpu.value?.word ?? STARTING_WORD);
  const solution = computed(() => solveControl(shape.value, word.value));
  /** The CPU's own view of its word, while that is the word on show. */
  const shown = computed(() => (edited.value === null ? fromCpu.value : null));
  const fields = computed(() =>
    wordFields(shape.value.reads, shown.value?.fields ?? null, word.value)
  );

  /** The program counter at the end of the CPU's instruction; a changed word never ran. */
  const pc = computed(() => {
    const request = shown.value?.pc ?? null;
    return request ? solvePc(request) : null;
  });

  function flipBit(bit: number): void {
    edited.value = withBitFlipped(word.value, bit);
  }

  /** Moves the clock on: up, then down. */
  function clock(): void {
    phase.value = NEXT_PHASE[phase.value];
  }

  /** Back to before the clock rose, with PC still at this instruction. */
  function rewind(): void {
    phase.value = 'before';
  }

  /** Back to the CPU's own word, or to the starting one when no CPU gave any. */
  function restore(): void {
    edited.value = null;
  }

  return {
    fromCpu,
    shape,
    word,
    solution,
    fields,
    pc,
    phase,
    /** Whether the page shows the CPU's word as it ran, with nothing changed. */
    asRun: computed(() => shown.value !== null),
    isEdited: computed(() => edited.value !== null),
    flipBit,
    clock,
    rewind,
    restore
  };
}

/** The word of the control topic, as its panels receive it. */
export type ControlLens = ReturnType<typeof useControlLens>;
