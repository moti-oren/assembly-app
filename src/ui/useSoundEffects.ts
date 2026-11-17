import { watch } from 'vue';
import { raisedOverflow, stepSound } from './sounds';
import type { Cpu } from './useCpu';
import { usePreferences } from './usePreferences';

/** Plays what the CPU does: each step, undo and redo, errors, and lines added to the program. */
export function useSoundEffects(cpu: Cpu): void {
  const { play } = usePreferences();
  const { state, history, lastRecord, finished, error, program } = cpu;

  // One instruction forward sounds like what it did; anything bigger is a single ratchet.
  watch(
    () => history.value.length,
    (length, previous) => {
      const record = lastRecord.value;
      if (length === previous + 1 && record) {
        play(stepSound(record, state));
        if (raisedOverflow(record, state)) play('overflow', 0.03);
        if (record.line !== null && finished.value) play('halt', 0.12);
      } else if (length === previous - 1) {
        play('undo');
      } else {
        play('ratchet');
      }
    }
  );
  watch(error, (message) => message && play('error'));
  watch(
    () => program.value.length,
    (length, previous) => length === previous + 1 && play('punch')
  );
}
