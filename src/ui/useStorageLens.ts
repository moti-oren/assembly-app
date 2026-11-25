import { computed, ref, watch } from 'vue';
import type { Width } from '@/core/logic/alu';
import { solveRegister, type ClockPhase } from '@/core/logic/register';
import {
  hasRegisters,
  type RegisterLink,
  type RegisterView,
  type RegisterWrite
} from '@/core/registerLink';
import { freeWrite, NEXT_PHASE, withBitFlipped, type RegisterRow } from './storageView';
import { useStorageCell } from './useStorageCell';

/** What the page shows before any CPU has given it a register. */
const STARTING = freeWrite(8, null);

/**
 * The register on show in the storage topic: one the CPU's last instruction wrote, or the
 * learner's own once they change a bit. The CPU is never touched.
 */
export function useStorageLens(link: () => RegisterLink | null) {
  /** The registers the CPU's last instruction wrote, when it wrote any. */
  const fromCpu = computed<RegisterView | null>(() => {
    const given = link();
    return given && hasRegisters(given) ? given : null;
  });
  /** Which of the registers the instruction wrote is on show. */
  const chosen = ref(0);
  /** The learner's own register, once they have changed anything. */
  const edited = ref<RegisterWrite | null>(null);
  const phase = ref<ClockPhase>('before');
  // A new moment of the CPU is shown as it happened, not with an old "what if" over it.
  watch(fromCpu, () => {
    chosen.value = 0;
    edited.value = null;
  });

  const cpuWrite = computed(() => fromCpu.value?.writes[chosen.value] ?? null);
  const write = computed(() => edited.value ?? cpuWrite.value ?? STARTING);
  const request = computed(() => write.value.request);
  const solution = computed(() => solveRegister(request.value));
  // Another register, or other values, start their cycle from before the clock rises.
  watch(request, () => {
    phase.value = 'before';
  });
  /** Every wire of the register at the moment of the cycle on show. */
  const signals = computed(() => solution.value.signals[phase.value]);

  /** Whether the page shows the CPU's register as it was written, with nothing changed. */
  const asRun = computed(() => fromCpu.value !== null && edited.value === null);
  /** Whether the register holds what the CPU wrote: colour marks a write, and only a real one. */
  const written = computed(() => asRun.value && phase.value !== 'before');

  const chosenBit = ref(0);
  /** The bit shown gate by gate, kept inside the register as its width changes. */
  const bit = computed(() => Math.min(chosenBit.value, request.value.width - 1));
  const cell = useStorageCell();

  function flipBit(row: RegisterRow, index: number): void {
    const flipped = withBitFlipped(request.value, row, index);
    // "Only AL is written" holds while the write lines are the CPU's, and no longer once changed.
    const cpu = cpuWrite.value;
    const part = cpu && flipped.enabled === cpu.request.enabled ? cpu.part : null;
    edited.value = { ...write.value, part, request: flipped };
  }

  function setWidth(width: Width): void {
    edited.value = freeWrite(width, request.value);
  }

  function chooseRegister(index: number): void {
    edited.value = null;
    chosen.value = index;
  }

  /** Puts a register from elsewhere on show, as the register file does with one of its own. */
  function show(given: RegisterWrite): void {
    edited.value = given;
  }

  function chooseBit(index: number): void {
    chosenBit.value = index;
    cell.pick('register');
  }

  /** Moves the clock on: up, then down. */
  function clock(): void {
    phase.value = NEXT_PHASE[phase.value];
  }

  /** Back to before the clock rose, with the old value still in the register. */
  function rewind(): void {
    phase.value = 'before';
  }

  /** Back to the CPU's own values, or to the starting ones when no CPU gave any. */
  function restore(): void {
    edited.value = null;
  }

  return {
    write,
    request,
    solution,
    signals,
    phase,
    fromCpu,
    chosen,
    isEdited: computed(() => edited.value !== null),
    asRun,
    written,
    bit,
    cell,
    flipBit,
    setWidth,
    chooseRegister,
    show,
    chooseBit,
    clock,
    rewind,
    restore
  };
}

/** The register of the storage topic, as its panels receive it. */
export type StorageLens = ReturnType<typeof useStorageLens>;
