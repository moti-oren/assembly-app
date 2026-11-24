<script setup lang="ts">
import { computed } from 'vue';
import { sliceHeading } from '@/ui/logicSlice';
import type { LogicLens } from '@/ui/useLogicLens';
import LogicDiagram from './LogicDiagram.vue';
import LogicFault from './LogicFault.vue';
import LogicNand from './LogicNand.vue';
import StageSection from './StageSection.vue';

const props = defineProps<{
  lens: LogicLens;
  /**
   * With the switches of the gate picked under its truth table: on a phone, where the sidebar
   * that holds them is another view.
   */
  withGateSwitches?: boolean;
}>();

const diagram = computed(() => props.lens.diagram.value);
const isShift = computed(() => props.lens.request.value.kind === 'shift');
const heading = computed(() =>
  sliceHeading(props.lens.shown.value, props.lens.bit.value, props.lens.stage.value)
);
</script>

<!-- One bit of the circuit, gate by gate, with the truth table of the gate picked. -->
<template>
  <StageSection :title="`${heading}, gate by gate`" label="The gates of one bit">
    <template #aside>
      {{ isShift ? 'Pick a bit in any row above.' : 'Pick another bit in the row above.' }}
    </template>
    <p v-if="!diagram" class="text-sm text-muted-foreground">
      With no rows there is nothing between the input and the result.
    </p>
    <LogicDiagram
      v-else
      :diagram="diagram"
      :signals="lens.shown.value.signals"
      :chosen="lens.gate.value"
      :label="heading"
      :written="lens.asRun.value"
      :stuck="lens.faults.value"
      @choose="lens.chooseGate"
    >
      <template v-if="withGateSwitches" #gate="{ gate }">
        <LogicFault :lens="lens" :gate="gate" />
      </template>
      <template #under="{ gate }">
        <LogicNand :lens="lens" :gate="gate" :with-switch="withGateSwitches" />
      </template>
    </LogicDiagram>
  </StageSection>
</template>
