import { computed, ref, shallowRef } from 'vue';
import { settle } from '@/core/logic/feedback';
import { dLatch, flipFlop, holdingBit, srLatch } from '@/core/logic/flipFlop';
import type { Bit, Circuit, Signals } from '@/core/logic/gates';
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

  function show(state: { inputs: Record<string, Bit>; signals: Signals; settled: boolean }): void {
    inputs.value = state.inputs;
    signals.value = state.signals;
    settled.value = state.settled;
  }

  function pick(next: CellId): void {
    cell.value = next;
    gate.value = 0;
    if (next !== 'register') show(atRest(next));
  }

  /** Flips one input of the cell worked by hand, and lets its gates react. */
  function flipInput(signal: string): void {
    if (!free.value) return;
    const next = { ...inputs.value, [signal]: (inputs.value[signal] ^ 1) as Bit };
    show({ inputs: next, ...settle(CIRCUITS[free.value], next, signals.value) });
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
    pick,
    flipInput,
    releaseAll,
    chooseGate
  };
}
