import { computed, ref, watch } from 'vue';
import { hasNumbers, type NumberLink, type NumberView } from '@/core/numberLink';
import type { Width } from '@/core/representation/readings';
import { solveNumber, type NumberRequest } from '@/core/representation/request';
import {
  freeRequest,
  freeView,
  sameOperation,
  widthOf,
  withBitFlipped,
  withExtraFlipped,
  withOperand,
  type LensId,
  type OperandKey
} from './numbersView';

/** What the page shows before any CPU has given it an operation. */
const STARTING = freeRequest('add', 8, null);

/**
 * The operation on show in the number topic: the CPU's last instruction, or the learner's own
 * once they change a value or pick another lens. The CPU is never touched.
 */
export function useNumberLens(link: () => NumberLink | null) {
  /** The CPU's operation, when its last instruction has one to show. */
  const fromCpu = computed<NumberView | null>(() => {
    const given = link();
    return given && hasNumbers(given) ? given : null;
  });
  /** The learner's own request, once they have changed anything. */
  const edited = ref<NumberRequest | null>(null);
  // A new moment of the CPU is shown as it happened, not with an old "what if" over it.
  watch(fromCpu, () => {
    edited.value = null;
  });

  const request = computed(() => edited.value ?? fromCpu.value?.request ?? STARTING);
  /** Whether the CPU's flags still apply: the operation is the CPU's, whatever its values. */
  const followsCpu = computed(
    () => fromCpu.value !== null && sameOperation(request.value, fromCpu.value.request)
  );
  const view = computed<NumberView>(() =>
    fromCpu.value && followsCpu.value
      ? { ...fromCpu.value, request: request.value }
      : freeView(request.value)
  );
  const solution = computed(() => solveNumber(request.value));
  const width = computed(() => widthOf(request.value));

  /** Whether the page shows the CPU's operation as it ran, with nothing changed. */
  const asRun = computed(() => fromCpu.value !== null && edited.value === null);
  /** Whether the CPU wrote the result on show: colour marks a write, and only a real one. */
  const written = computed(() => asRun.value && view.value.resultKept);
  /** Whether the CPU threw the result away and kept only its flags, as a comparison does. */
  const discarded = computed(() => followsCpu.value && !view.value.resultKept);

  function change(next: NumberRequest): void {
    edited.value = next;
  }

  function setOperand(operand: OperandKey, value: number): void {
    change(withOperand(request.value, operand, value));
  }

  function flipBit(operand: OperandKey, bit: number): void {
    change(withBitFlipped(request.value, operand, bit));
  }

  function flipExtra(): void {
    change(withExtraFlipped(request.value));
  }

  function pick(lens: LensId): void {
    change(freeRequest(lens, width.value, request.value));
  }

  function setWidth(next: Width): void {
    change(freeRequest(request.value.kind, next, request.value));
  }

  /** Back to the CPU's own values, or to the starting ones when no CPU gave any. */
  function restore(): void {
    edited.value = null;
  }

  return {
    request,
    view,
    solution,
    width,
    fromCpu,
    followsCpu,
    isEdited: computed(() => edited.value !== null),
    asRun,
    written,
    discarded,
    change,
    setOperand,
    flipBit,
    flipExtra,
    pick,
    setWidth,
    restore
  };
}

/** The operation of the number topic, as its panels receive it. */
export type NumberLens = ReturnType<typeof useNumberLens>;
