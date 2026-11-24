<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { nandCost, nandCostText, nandDiagram, nandLabel, nandSignals } from '@/ui/logicNand';
import type { DiagramGate } from '@/ui/logicSlice';
import type { LogicLens } from '@/ui/useLogicLens';
import LogicDrawing from './LogicDrawing.vue';

const props = defineProps<{
  lens: LogicLens;
  /** The gate picked in the drawing. */
  gate: DiagramGate;
}>();

const open = computed(() => props.lens.nandShown.value);
const diagram = computed(() => nandDiagram(props.gate));
const stuck = computed(() => props.lens.faults.value[props.gate.id] ?? null);
const signals = computed(() =>
  nandSignals(props.gate, props.lens.shown.value.signals, stuck.value)
);
const broken = computed(() => (stuck.value === null ? {} : { [props.gate.id]: stuck.value }));
/** Worked out only while it is read: the whole circuit is built again from NAND gates. */
const circuitCost = computed(() => nandCost(props.lens.healthy.value.circuit));
const cost = computed(() =>
  nandCostText(props.gate, props.lens.diagram.value?.gates ?? [], circuitCost.value)
);
</script>

<!-- The gate picked, built from NAND gates alone, and what that costs. -->
<template>
  <div v-if="diagram">
    <Button
      :variant="open ? 'default' : 'outline'"
      size="sm"
      class="pointer-coarse:h-11"
      :aria-pressed="open"
      @click="lens.toggleNand()"
    >
      As NAND gates
    </Button>
    <div v-if="open" class="mt-3 flex flex-col gap-3">
      <div class="well overflow-x-auto rounded-lg p-3">
        <LogicDrawing
          still
          :diagram="diagram"
          :signals="signals"
          :stuck="broken"
          :label="nandLabel(gate)"
        />
      </div>
      <p class="max-w-prose text-sm text-pretty text-muted-foreground">
        A NAND gate puts out 0 only when both its inputs are 1, and every other gate can be built
        from it. {{ diagram.expressions[0] }}
      </p>
      <p class="max-w-prose text-sm text-pretty text-muted-foreground">{{ cost }}</p>
    </div>
  </div>
</template>
