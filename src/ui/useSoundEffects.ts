import { watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { StepSound } from './sounds';
import type { CpuControls } from './useCpu';
import { usePreferences } from './usePreferences';

/** What one executed instruction sounds like, and whether it broke a signed result. */
export type SoundOf<Record> = (record: Record) => { step: StepSound; overflow: boolean };

/** Plays what the CPU does: each step, undo and redo, errors, and lines added to the program. */
export function useSoundEffects<Instruction, Record extends ExecutionRecord>(
  cpu: CpuControls<Instruction, Record>,
  soundOf: SoundOf<Record>
): void {
  const { play } = usePreferences();
  const { history, lastRecord, finished, error, program } = cpu;

  // One instruction forward sounds like what it did; anything bigger is a single ratchet.
  watch(
    () => history.value.length,
    (length, previous) => {
      const record = lastRecord.value;
      if (length === previous + 1 && record) {
        const { step, overflow } = soundOf(record);
        play(step);
        if (overflow) play('overflow', 0.03);
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
