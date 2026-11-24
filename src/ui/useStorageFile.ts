import { computed, ref, watch } from 'vue';
import type { ClockPhase } from '@/core/logic/register';
import { solveRegisterFile, type RegisterFileRequest } from '@/core/logic/registerFile';
import type { RegisterFileView, RegisterLink } from '@/core/registerLink';
import { FREE_FILE, withAddressBitFlipped, withWriteFlipped } from './storageFile';
import { NEXT_PHASE } from './storageView';

/**
 * The register file on show in the storage topic: the CPU's as its last instruction found it, or
 * the learner's own once they change the address or the write line. The CPU is never touched.
 */
export function useStorageFile(link: () => RegisterLink | null) {
  /** The file the CPU's last instruction wrote to, when its registers are picked by an address. */
  const fromCpu = computed<RegisterFileView | null>(() => link()?.file ?? null);
  const edited = ref<RegisterFileRequest | null>(null);
  const phase = ref<ClockPhase>('before');
  // A new moment of the CPU is shown as it happened, not with an old "what if" over it.
  watch(fromCpu, () => {
    edited.value = null;
  });

  const view = computed<RegisterFileView>(() => {
    const given = fromCpu.value ?? FREE_FILE;
    return edited.value ? { ...given, request: edited.value } : given;
  });
  const request = computed(() => view.value.request);
  const solution = computed(() => solveRegisterFile(request.value));
  // Another address, or another file, starts its cycle from before the clock rises.
  watch(request, () => {
    phase.value = 'before';
  });

  function flipAddress(bit: number): void {
    edited.value = withAddressBitFlipped(request.value, bit);
  }

  function flipWrite(): void {
    edited.value = withWriteFlipped(request.value);
  }

  /** Moves the clock on: up, then down. */
  function clock(): void {
    phase.value = NEXT_PHASE[phase.value];
  }

  /** Back to before the clock rose, with the old values still in the registers. */
  function rewind(): void {
    phase.value = 'before';
  }

  /** Back to the CPU's own address and write line, or to the starting ones. */
  function restore(): void {
    edited.value = null;
  }

  return {
    view,
    request,
    solution,
    phase,
    fromCpu,
    isEdited: computed(() => edited.value !== null),
    /** Whether the file is the CPU's as it was written: colour marks a write, and a real one. */
    asRun: computed(() => fromCpu.value !== null && edited.value === null),
    flipAddress,
    flipWrite,
    clock,
    rewind,
    restore
  };
}

/** The register file of the storage topic, as its panel receives it. */
export type StorageFile = ReturnType<typeof useStorageFile>;
