import { watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { sound } from './soundEngine';
import { deviceSounds, type StepSounds } from './sounds';
import type { CpuControls } from './useCpu';

/** What one executed instruction sounds like on the workbench's architecture. */
export type SoundOf<Record> = (record: Record) => StepSounds;

/** Seconds between the sounds of one instruction, so they are heard as separate events. */
const LAYER_GAP = 0.03;

/**
 * Plays what the CPU does: the phases of the cycle, each instruction, moves through the
 * history, errors, and edits to the program.
 */
export function useSoundEffects<Instruction, Record extends ExecutionRecord>(
  cpu: CpuControls<Instruction, Record>,
  soundOf: SoundOf<Record>
): void {
  const { history, future, finished, error, program, pending, running, speed } = cpu;

  function playStep(record: Record): void {
    // A fast run is a rhythm, not a list of events: one soft pulse per line.
    if (running.value && speed.value === 'fast') {
      sound.play('clock');
      return;
    }
    const { step, layers } = soundOf(record);
    sound.play(step);
    [...layers, ...deviceSounds(record)].forEach((name, index) =>
      sound.play(name, { delay: LAYER_GAP * (index + 1) })
    );
  }

  watch([history, future], ([now, ahead], [before, wasAhead]) => {
    if (!sound.isEnabled() || now.length === before.length) return;
    const last = now.at(-1);
    if (now.length < before.length || !last) {
      // With nothing left to redo either, this was a reset rather than a step back.
      sound.play(now.length === 0 && ahead.length === 0 ? 'detent' : 'undo');
      return;
    }
    if (wasAhead.includes(last)) {
      sound.play('redo');
      return;
    }
    // Several at once is an instant run: there is no single instruction to hear.
    if (now.length === before.length + 1) playStep(last);
    else sound.play('clock');
    if (last.line !== null && finished.value) sound.play('halt', { delay: 0.14 });
  });

  watch(
    () => pending.value?.phase,
    (phase) => phase && sound.play(phase)
  );
  watch(error, (message) => message && sound.play('error'));
  watch(
    () => program.value.length,
    (length, previous) => {
      const added = length - previous;
      // One builder entry is one line, or the two a RISC-V pseudo-instruction stands for.
      if (added === 1 || added === 2) sound.play('add');
      else if (added === -1 || length === 0) sound.play('remove');
      else sound.play('detent');
    }
  );
}
