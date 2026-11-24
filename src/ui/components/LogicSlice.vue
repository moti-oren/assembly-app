<script setup lang="ts">
import { computed } from 'vue';
import { sliceHeading } from '@/ui/logicSlice';
import type { LogicLens } from '@/ui/useLogicLens';
import LogicDiagram from './LogicDiagram.vue';
import LogicFault from './LogicFault.vue';
import LogicNand from './LogicNand.vue';

const props = defineProps<{ lens: LogicLens }>();

const diagram = computed(() => props.lens.diagram.value);
const isShift = computed(() => props.lens.request.value.kind === 'shift');
const heading = computed(() =>
  sliceHeading(props.lens.shown.value, props.lens.bit.value, props.lens.stage.value)
);
</script>

<!-- One bit of the circuit, gate by gate, with the truth table of the gate picked. -->
<template>
  <section aria-label="The gates of one bit">
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 class="text-sm font-semibold">{{ heading }}, gate by gate</h3>
      <p class="text-xs text-muted-foreground">
        {{ isShift ? 'Pick a bit in any row above.' : 'Pick another bit in the row above.' }}
      </p>
    </div>
    <p v-if="!diagram" class="mt-3 text-sm text-muted-foreground">
      With no rows there is nothing between the input and the result.
    </p>
    <LogicDiagram
      v-else
      class="mt-3"
      :diagram="diagram"
      :signals="lens.shown.value.signals"
      :chosen="lens.gate.value"
      :label="heading"
      :written="lens.asRun.value"
      :stuck="lens.faults.value"
      @choose="lens.chooseGate"
    >
      <template #gate="{ gate }">
        <LogicFault :lens="lens" :gate="gate" />
      </template>
      <template #under="{ gate }">
        <LogicNand :lens="lens" :gate="gate" />
      </template>
    </LogicDiagram>
  </section>
</template>
