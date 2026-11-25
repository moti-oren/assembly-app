import { computed, shallowRef, type Ref } from 'vue';
import type { AluRequest, AluSolution } from '@/core/logic/alu';
import type { Faults } from '@/core/logic/fault';
import type { Bit } from '@/core/logic/gates';
import { analytics } from './analyticsClient';
import { brokenBits, withFault, withoutFault, wrongBits } from './logicFault';
import { sameGates } from './logicView';

const NONE: Faults = {};

/**
 * The gates the learner broke in the circuit of the logic topic. They stay broken while the
 * circuit stays on the same gates, whatever values run through it (an addition and a subtraction
 * share the adder's), so a fault can be followed from one instruction of the CPU to the next.
 * Another circuit has other gates, and starts whole.
 * `beforeChange` runs before a gate breaks or is mended.
 */
export function useLogicFaults(request: Readonly<Ref<AluRequest>>, beforeChange: () => void) {
  /** The faults, with the circuit whose gates they name. */
  const kept = shallowRef<{ of: AluRequest; faults: Faults } | null>(null);
  const faults = computed<Faults>(() =>
    kept.value && sameGates(kept.value.of, request.value) ? kept.value.faults : NONE
  );
  const count = computed(() => Object.keys(faults.value).length);
  const any = computed(() => count.value > 0);

  function keep(next: Faults): void {
    beforeChange();
    kept.value = Object.keys(next).length > 0 ? { of: request.value, faults: next } : null;
  }

  /** Breaks the gate that drives `signal`: its output stays at `value`. */
  function stick(signal: string, value: Bit): void {
    if (faults.value[signal] === undefined) analytics.track({ name: 'gate-broken' });
    keep(withFault(faults.value, signal, value));
  }

  function repair(signal: string): void {
    keep(withoutFault(faults.value, signal));
  }

  function repairAll(): void {
    keep(NONE);
  }

  /** The broken circuit set beside the working one, once it is at rest; null with no fault. */
  function beside(
    healthy: Readonly<Ref<AluSolution>>,
    broken: Readonly<Ref<AluSolution>>,
    settled: Readonly<Ref<boolean>>
  ) {
    return {
      /** The bits of the result a broken gate gets wrong. */
      wrong: computed(() =>
        any.value && settled.value ? wrongBits(healthy.value, broken.value) : null
      ),
      /** The bits one of whose gates is broken. */
      broken: computed(() => (any.value ? brokenBits(faults.value, broken.value) : null))
    };
  }

  return { faults, count, any, stick, repair, repairAll, beside };
}
