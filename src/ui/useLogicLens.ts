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
import { isAdder, longestCarry, shownSolution } from './logicTime';
import { useLogicChoice } from './useLogicChoice';
import { useLogicFaults } from './useLogicFaults';
import { useLogicTime } from './useLogicTime';

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
  // A gate that breaks or is mended changes the wires from where they are, not from rest.
  const faults = useLogicFaults(request, () => time.keep());
  /** The circuit with every gate working, which a broken one is set beside. */
  const healthy = computed(() => solve(request.value));
  const solution = computed(() =>
    faults.any.value ? solve(request.value, faults.faults.value) : healthy.value
  );
  const operation = computed(() => operationOf(request.value));
  const time = useLogicTime(request, solution);
  /** The circuit at the moment on show: at rest, or part of the way there while time is slowed. */
  const shown = computed(() =>
    time.on.value ? shownSolution(solution.value, time.signals.value) : solution.value
  );

  /**
   * Whether the circuit shows the CPU's operation as it ran: nothing changed, no gate broken,
   * every wire at rest.
   */
  const asRun = computed(
    () => fromCpu.value !== null && edited.value === null && !faults.any.value && time.settled.value
  );
  /** Whether the CPU wrote the result on show: colour marks a write, and only a real one. */
  const written = computed(() => asRun.value && circuit.value.resultKept);

  const choice = useLogicChoice(request, shown);
  /** Whether the gate picked is also drawn as the NAND gates it can be built from. */
  const nandShown = ref(false);
  const { wrong, broken } = faults.beside(healthy, solution, time.settled);

  function flipBit(operand: OperandKey, index: number): void {
    time.keep();
    edited.value = withBitFlipped(request.value, operand, index);
  }

  function flipCarryIn(): void {
    time.keep();
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

  /** Slows time on the values that keep the adder busy the longest, starting from rest. */
  function tryLongestCarry(): void {
    const current = request.value;
    if (!isAdder(current)) return;
    if (!time.on.value) time.toggle();
    edited.value = longestCarry(current);
  }

  /** Back to the CPU's own values, or to the starting circuit when no CPU gave one. */
  function restore(): void {
    edited.value = null;
  }

  return {
    request,
    circuit,
    solution,
    healthy,
    shown,
    faults: faults.faults,
    faultCount: faults.count,
    wrong,
    broken,
    stickGate: faults.stick,
    repairGate: faults.repair,
    repairAll: faults.repairAll,
    time,
    operation,
    fromCpu,
    followsCpu,
    /** Whether the CPU threw this result away and kept only what the wires say about it. */
    discarded: computed(() => followsCpu.value && !circuit.value.resultKept),
    isEdited: computed(() => edited.value !== null),
    asRun,
    written,
    ...choice,
    nandShown,
    toggleNand: () => {
      nandShown.value = !nandShown.value;
    },
    flipBit,
    flipCarryIn,
    flipStage,
    pick,
    setWidth,
    tryLongestCarry,
    restore
  };
}

/** The circuit of the logic topic, as its panels receive it. */
export type LogicLens = ReturnType<typeof useLogicLens>;
