import { computed, ref, shallowRef } from 'vue';
import { settle } from '@/core/logic/feedback';
import { dLatch, flipFlop, holdingBit, srLatch } from '@/core/logic/flipFlop';
import type { Bit, Circuit, Signals } from '@/core/logic/gates';
import { recorded, type Sample } from './storageTiming';
import { CELL_INPUTS, type CellId, type FreeCellId } from './storageView';

const CIRCUITS: Record<FreeCellId, Circuit> = {
  sr: srLatch(),
  d: dLatch(),
  flipFlop: flipFlop()
};

/** A cell with every input at 0, holding a 0. */
function atRest(cell: FreeCellId) {
  const inputs = Object.fromEntries(CELL_INPUTS[cell].map(({ signal }) => [signal, 0 as Bit]));
  return { inputs, ...settle(CIRCUITS[cell], inputs, holdingBit(0)) };
}

/**
 * The memory cell on show gate by gate, and, for the cells worked by hand, the values on its
 * inputs and what its gates hold: a cell remembers, so each change starts from the last one.
 */
export function useStorageCell() {
  const cell = ref<CellId>('register');
  const inputs = shallowRef<Record<string, Bit>>({});
  const signals = shallowRef<Signals>({});
  const settled = ref(true);
  /** The gate whose truth table is on show, by its place in the drawing. */
  const gate = ref(0);

  /** The cell worked by hand, or null while the register's own bit is on show. */
  const free = computed<FreeCellId | null>(() => (cell.value === 'register' ? null : cell.value));

  /** The cell after each change made by hand, the newest last, for the timing diagram. */
  const trace = shallowRef<Sample[]>([]);

  /** How many samples the last press added: a pulse adds two, and both are told. */
  const pressSteps = ref(1);

  function show(state: Sample & { inputs: Record<string, Bit> }): void {
    inputs.value = state.inputs;
    signals.value = state.signals;
    settled.value = state.settled;
    trace.value = recorded(trace.value, { signals: state.signals, settled: state.settled });
    pressSteps.value = 1;
  }

  /** Starts the timing diagram over, from the cell as it is. */
  function clearTrace(): void {
    trace.value = trace.value.slice(-1);
  }

  function pick(next: CellId): void {
    cell.value = next;
    gate.value = 0;
    trace.value = [];
    if (next !== 'register') show(atRest(next));
  }

  /** Flips one input of the cell worked by hand, and lets its gates react. */
  function flipInput(signal: string): void {
    if (!free.value) return;
    const next = { ...inputs.value, [signal]: (inputs.value[signal] ^ 1) as Bit };
    show({ inputs: next, ...settle(CIRCUITS[free.value], next, signals.value) });
  }

  /** Flips an input and flips it back: a whole tick of a clock in one press. */
  function pulse(signal: string): void {
    if (!free.value) return;
    flipInput(signal);
    flipInput(signal);
    pressSteps.value = 2;
  }

  /** Whether both inputs of the SR latch are held at 1, the one state it must not be left from. */
  const bothHeld = computed(
    () => free.value === 'sr' && CELL_INPUTS.sr.every(({ signal }) => inputs.value[signal] === 1)
  );

  /** Lets go of every input in the same instant, which no two presses can do. */
  function releaseAll(): void {
    if (!free.value) return;
    const next = Object.fromEntries(Object.keys(inputs.value).map((signal) => [signal, 0 as Bit]));
    show({ inputs: next, ...settle(CIRCUITS[free.value], next, signals.value) });
  }

  function chooseGate(index: number): void {
    gate.value = index;
  }

  return {
    cell,
    free,
    inputs,
    signals,
    settled,
    bothHeld,
    gate,
    trace,
    pressSteps,
    pick,
    flipInput,
    pulse,
    clearTrace,
    releaseAll,
    chooseGate
  };
}
