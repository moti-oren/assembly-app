import { computed, ref, watch } from 'vue';
import { hasControl, solveControl, type ControlLink, type ControlView } from '@/core/controlLink';
import { solvePc } from '@/core/logic/programCounter';
import type { ClockPhase } from '@/core/logic/register';
import { RV32_CONTROL } from '@/core/rv32Control';
import { rv32WordFields } from '@/core/rv32ControlLink';
import { runDatapath } from '@/core/rv32ControlPath';
import { STARTING_WORD, withBitFlipped, wordFields } from './controlView';
import { NEXT_PHASE } from './storageView';
import { useControlFaults } from './useControlFaults';

/**
 * The instruction word on show in the control topic: the one the CPU ran last, or the learner's
 * own once they change a bit or type a word. The CPU is never touched.
 */
export function useControlLens(link: () => ControlLink | null) {
  /** What the control unit made of the CPU's last instruction, when it has one to show. */
  const fromCpu = computed<ControlView | null>(() => {
    const given = link();
    return given && hasControl(given) ? given : null;
  });
  /** The learner's own word, once they have changed a bit or typed one. */
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
  const broken = useControlFaults();
  /** The decoders with every line working. */
  const healthy = computed(() => solveControl(shape.value, word.value));
  const solution = computed(() =>
    broken.any.value ? solveControl(shape.value, word.value, broken.faults.value) : healthy.value
  );
  /** The CPU's own view of its word, while that is the word on show. */
  const shown = computed(() => (edited.value === null ? fromCpu.value : null));
  const fields = computed(() =>
    wordFields(shape.value.reads, shown.value?.fields ?? rv32WordFields(word.value), word.value)
  );

  /** The registers and memory the CPU's instruction found, which any word here is run against. */
  const context = computed(() => fromCpu.value?.context ?? null);
  /** What the lines make the datapath do with the word on show. */
  const outcome = computed(() =>
    context.value ? runDatapath(word.value, solution.value, context.value) : null
  );
  /** The same with every line working, while a line is broken. */
  const wholeOutcome = computed(() =>
    context.value && broken.any.value ? runDatapath(word.value, healthy.value, context.value) : null
  );

  /**
   * The program counter at the end of the instruction: the CPU's own while its word is on show
   * with every line working, and otherwise where the datapath sends it.
   */
  const pc = computed(() => {
    if (shown.value && (shown.value.pc === null || !broken.any.value)) {
      return shown.value.pc && solvePc(shown.value.pc);
    }
    return outcome.value && solvePc(outcome.value.pc);
  });

  function flipBit(bit: number): void {
    edited.value = withBitFlipped(word.value, bit);
  }

  function setWord(next: number): void {
    edited.value = next;
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
    healthy,
    faults: broken.faults,
    anyBroken: broken.any,
    pickedLine: broken.picked,
    pickLine: broken.pick,
    stickLine: broken.stick,
    repairLine: broken.repair,
    repairLines: broken.repairAll,
    fields,
    outcome,
    wholeOutcome,
    pc,
    phase,
    /** Whether the page shows the CPU's word as it ran, with nothing changed or broken. */
    asRun: computed(() => shown.value !== null && !broken.any.value),
    isEdited: computed(() => edited.value !== null),
    flipBit,
    setWord,
    clock,
    rewind,
    restore
  };
}

/** The word of the control topic, as its panels receive it. */
export type ControlLens = ReturnType<typeof useControlLens>;
