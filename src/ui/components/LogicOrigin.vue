<script setup lang="ts">
import { computed } from 'vue';
import { hasCircuit, type AluLink } from '@/core/aluLink';
import type { CpuMoment } from '@/ui/cpuMoment';
import { equationText } from '@/ui/logicView';
import type { LogicLens } from '@/ui/useLogicLens';
import TopicOrigin from './TopicOrigin.vue';

const props = defineProps<{
  lens: LogicLens;
  /** The moment of the CPU the circuit follows. */
  moment: CpuMoment<AluLink>;
}>();
defineEmits<{ seek: [position: number]; back: [] }>();

const equation = computed(() =>
  equationText(props.lens.request.value, props.lens.solution.value.result)
);
/** Why the CPU's last instruction has no circuit here, when it has none. */
const unavailable = computed(() => {
  const { link } = props.moment;
  return link && !hasCircuit(link)
    ? `${link.unavailable} The circuit below is one to try by hand.`
    : null;
});
const discarded = computed(
  () =>
    props.lens.fromCpu.value !== null &&
    !props.lens.circuit.value.resultKept &&
    props.lens.followsCpu.value
);
</script>

<!-- Where the circuit on show came from: a moment of the CPU, or the learner's own values. -->
<template>
  <TopicOrigin
    :moment="moment"
    :equation="equation"
    :edited="lens.isEdited.value"
    :from-cpu="lens.fromCpu.value !== null"
    :unavailable="unavailable"
    :aside="
      discarded
        ? 'The CPU throws this result away and keeps only what the wires below say about it.'
        : null
    "
    @seek="$emit('seek', $event)"
    @back="$emit('back')"
    @restore="lens.restore()"
  />
</template>
