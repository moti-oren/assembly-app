import { computed, readonly, ref, shallowRef } from 'vue';
import type { Faults } from '@/core/logic/fault';
import type { Bit } from '@/core/logic/gates';
import { analytics } from './analyticsClient';
import { withFault, withoutFault } from './logicFault';

const NONE: Faults = {};

/**
 * The control lines the learner broke, and the one picked to break. They stay broken from one
 * instruction of the CPU to the next, so a program can be followed with a line stuck; they are
 * never part of what a CPU ran.
 */
export function useControlFaults() {
  const faults = shallowRef<Faults>(NONE);
  /** The line whose switch is on show. */
  const picked = ref<string | null>(null);

  /** Puts a line's switch on show, or away when it is the one on show. */
  function pick(line: string): void {
    picked.value = picked.value === line ? null : line;
  }

  /** Breaks a line: it stays at `value` whatever the decoders say. */
  function stick(line: string, value: Bit): void {
    if (faults.value[line] === undefined) analytics.track({ name: 'line-broken' });
    faults.value = withFault(faults.value, line, value);
  }

  function repair(line: string): void {
    faults.value = withoutFault(faults.value, line);
  }

  function repairAll(): void {
    faults.value = NONE;
  }

  return {
    faults,
    picked: readonly(picked),
    pick,
    any: computed(() => Object.keys(faults.value).length > 0),
    stick,
    repair,
    repairAll
  };
}
