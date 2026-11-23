import { computed, onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue';
import type { AluRequest, AluSolution } from '@/core/logic/alu';
import type { Signals } from '@/core/logic/gates';
import { depth } from '@/core/logic/propagation';
import { followThrough, isAdder, sharesWires } from './logicTime';
import { usePreferences } from './usePreferences';

/** How long one gate delay is on show while the delays play by themselves. */
const DELAY_MS = 150;

/**
 * The adder of the logic topic slowed down: its wires gate delay by gate delay, from the moment
 * its inputs changed to the moment it comes to rest. Off, the circuit is shown at rest.
 */
export function useLogicTime(
  request: Readonly<Ref<AluRequest>>,
  solution: Readonly<Ref<AluSolution>>
) {
  const { calm } = usePreferences();
  /** Whether the learner asked for time; only the adder has it to show. */
  const asked = ref(false);
  const available = computed(() => isAdder(request.value));
  const on = computed(() => asked.value && available.value);

  /** Every wire as it was before the inputs changed; null for an adder at rest. */
  const held = shallowRef<Signals | null>(null);
  /** Set by an edit that changes the values on the same wires, for the change it is about to make. */
  let continues = false;
  const step = ref(0);
  const playing = ref(false);
  let timer: number | undefined;

  const propagation = computed(() => (on.value ? followThrough(solution.value, held.value) : null));
  /** The gate delay at which the circuit comes to rest. */
  const last = computed(() => (propagation.value ? propagation.value.steps.length - 1 : 0));
  /** The gate delays the circuit has to be given, whatever its inputs. */
  const worst = computed(() => (on.value ? depth(solution.value.circuit) : 0));
  const settled = computed(() => step.value >= last.value);
  /** Every wire at the moment on show. */
  const signals = computed(
    () => propagation.value?.steps[Math.min(step.value, last.value)] ?? solution.value.signals
  );

  function pause(): void {
    playing.value = false;
    window.clearTimeout(timer);
  }

  function tick(): void {
    step.value = Math.min(step.value + 1, last.value);
    if (settled.value) pause();
    else timer = window.setTimeout(tick, DELAY_MS);
  }

  /** Lets the gate delays pass by themselves, from the start when they have all passed. */
  function play(): void {
    pause();
    if (!on.value || last.value === 0) return;
    if (settled.value) step.value = 0;
    playing.value = true;
    timer = window.setTimeout(tick, DELAY_MS);
  }

  /** Shows a change from its first moment. With motion cut down it is shown at rest, to step through. */
  function begin(): void {
    pause();
    if (calm.value) {
      step.value = last.value;
      return;
    }
    step.value = 0;
    play();
  }

  watch(solution, (now, before) => {
    held.value = continues && sharesWires(now.request, before.request) ? before.signals : null;
    continues = false;
    if (on.value) begin();
    else pause();
  });

  function toggle(): void {
    asked.value = !asked.value;
    held.value = null;
    if (on.value) begin();
    else pause();
  }

  /** The next change of the inputs starts from the wires as they are now, not from rest. */
  function keep(): void {
    continues = true;
  }

  function seek(to: number): void {
    pause();
    step.value = Math.max(0, Math.min(to, last.value));
  }

  onScopeDispose(pause);
  // The page is kept alive when another topic is shown: its delays do not play on unseen.
  onDeactivated(pause);

  return {
    available,
    on,
    step,
    last,
    worst,
    settled,
    playing,
    propagation,
    signals,
    toggle,
    keep,
    play,
    pause,
    seek,
    stepOn: () => seek(step.value + 1),
    stepBack: () => seek(step.value - 1),
    rewind: () => seek(0)
  };
}
