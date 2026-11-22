import { computed, ref, watch } from 'vue';
import { hasCircuit, type AluCircuit, type AluLink } from '@/core/aluLink';
import { solve, type AluRequest, type Width } from '@/core/logic/alu';
import {
  freeCircuit,
  freeRequest,
  operationOf,
  sameCircuit,
  withBitFlipped,
  withCarryInFlipped,
  withStageFlipped,
  type FreeOperation,
  type OperandKey
} from './logicView';

/** What the circuit shows before any CPU has given it an operation. */
const STARTING = freeRequest('add', 8, null);

/**
 * The circuit on show in the logic topic: the one behind the CPU's last instruction, or the
 * learner's own once they change an input or pick another operation. The CPU is never touched.
 */
export function useLogicLens(link: () => AluLink | null) {
  /** The CPU's circuit, when its last instruction has one. */
  const fromCpu = computed<AluCircuit | null>(() => {
    const given = link();
    return given && hasCircuit(given) ? given : null;
  });
  /** The learner's own request, once they have changed anything. */
  const edited = ref<AluRequest | null>(null);
  // A new moment of the CPU is shown as it happened, not with an old "what if" over it.
  watch(fromCpu, () => {
    edited.value = null;
  });

  const request = computed(() => edited.value ?? fromCpu.value?.request ?? STARTING);
  /** Whether the CPU's flags still apply: the circuit is the CPU's, whatever its inputs. */
  const followsCpu = computed(
    () => fromCpu.value !== null && sameCircuit(request.value, fromCpu.value.request)
  );
  const circuit = computed<AluCircuit>(() =>
    fromCpu.value && followsCpu.value
      ? { ...fromCpu.value, request: request.value }
      : freeCircuit(request.value)
  );
  const solution = computed(() => solve(request.value));
  const operation = computed(() => operationOf(request.value));

  /** Whether the circuit shows the CPU's operation as it ran, with nothing changed. */
  const asRun = computed(() => fromCpu.value !== null && edited.value === null);
  /** Whether the CPU wrote the result on show: colour marks a write, and only a real one. */
  const written = computed(() => asRun.value && circuit.value.resultKept);

  const chosenBit = ref(0);
  const chosenStage = ref(0);
  /** The gate whose truth table is on show, by its place in the drawing of one bit. */
  const gate = ref(0);
  // Another kind of circuit has other gates; the same circuit keeps the one picked.
  watch(
    () => request.value.kind,
    () => {
      gate.value = 0;
    }
  );
  /** The bit and the shifter row shown gate by gate, kept inside the circuit as it changes. */
  const bit = computed(() => Math.min(chosenBit.value, request.value.width - 1));
  const stage = computed(() => {
    const current = request.value;
    const rows = current.kind === 'shift' ? current.stages.length : 1;
    return Math.min(chosenStage.value, Math.max(rows - 1, 0));
  });

  function flipBit(operand: OperandKey, index: number): void {
    edited.value = withBitFlipped(request.value, operand, index);
  }

  function flipCarryIn(): void {
    edited.value = withCarryInFlipped(request.value);
  }

  function flipStage(index: number): void {
    const current = request.value;
    if (current.kind === 'shift') edited.value = withStageFlipped(current, index);
  }

  function pick(choice: FreeOperation): void {
    edited.value = freeRequest(choice, request.value.width, request.value);
  }

  function setWidth(width: Width): void {
    edited.value = freeRequest(operation.value ?? 'add', width, request.value);
  }

  /** Back to the CPU's own values, or to the starting circuit when no CPU gave one. */
  function restore(): void {
    edited.value = null;
  }

  function choose(index: number, row = 0): void {
    chosenBit.value = index;
    chosenStage.value = row;
  }

  function chooseGate(index: number): void {
    gate.value = index;
  }

  return {
    request,
    circuit,
    solution,
    operation,
    fromCpu,
    followsCpu,
    isEdited: computed(() => edited.value !== null),
    asRun,
    written,
    gate,
    bit,
    stage,
    flipBit,
    flipCarryIn,
    flipStage,
    pick,
    setWidth,
    restore,
    choose,
    chooseGate
  };
}

/** The circuit of the logic topic, as its panels receive it. */
export type LogicLens = ReturnType<typeof useLogicLens>;
