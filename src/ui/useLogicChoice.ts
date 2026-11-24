import { computed, ref, watch, type Ref } from 'vue';
import type { AluRequest, AluSolution } from '@/core/logic/alu';
import { sliceDiagram } from './logicSlice';

/**
 * What the learner picked to look into in the logic topic's circuit: a bit (in a shifter, of one
 * row), and a gate of that bit's drawing.
 */
export function useLogicChoice(
  request: Readonly<Ref<AluRequest>>,
  shown: Readonly<Ref<AluSolution>>
) {
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
  /** The bit on show drawn gate by gate; null for a shifter with no rows. */
  const diagram = computed(() => sliceDiagram(shown.value, bit.value, stage.value));
  const chosenGate = computed(() => diagram.value?.gates[gate.value] ?? null);

  function choose(index: number, row = 0): void {
    chosenBit.value = index;
    chosenStage.value = row;
  }

  function chooseGate(index: number): void {
    gate.value = index;
  }

  return { gate, bit, stage, diagram, chosenGate, choose, chooseGate };
}
