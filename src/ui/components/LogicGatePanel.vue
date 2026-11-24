<script setup lang="ts">
import { computed } from 'vue';
import { nandDiagram } from '@/ui/logicNand';
import type { LogicLens } from '@/ui/useLogicLens';
import LogicFault from './LogicFault.vue';
import LogicNandSwitch from './LogicNandSwitch.vue';

const props = defineProps<{ lens: LogicLens }>();

const gate = computed(() => props.lens.chosenGate.value);
</script>

<!-- The gate picked in the drawing of one bit: to break it, and to see it as NAND gates. -->
<template>
  <p v-if="!gate" class="text-sm text-pretty text-muted-foreground">
    Press a gate in the drawing of one bit to pick it.
  </p>
  <div v-else class="flex flex-col gap-3">
    <p class="text-xs font-semibold">
      {{ gate.kind.toUpperCase() }}
      <span class="font-normal text-muted-foreground">: {{ gate.name }}</span>
    </p>
    <LogicFault :lens="lens" :gate="gate" />
    <LogicNandSwitch v-if="nandDiagram(gate)" :lens="lens" />
  </div>
</template>
