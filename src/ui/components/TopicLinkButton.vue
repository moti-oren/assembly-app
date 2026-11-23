<script setup lang="ts">
import { Binary, CircuitBoard, MemoryStick } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LinkedTopic } from '@/ui/topics';
import { useTopic } from '@/ui/useTopic';
import TapTooltip from './TapTooltip.vue';

defineProps<{
  /** The topic the instruction on show is opened in. */
  topic: LinkedTopic;
  /** Why that topic has nothing to show for the instruction, or null when it has. */
  unavailable: string | null;
}>();

const { showCircuit, showNumbers, showStorage } = useTopic();

const LINKS = {
  logic: {
    label: 'Gates',
    icon: CircuitBoard,
    open: showCircuit,
    title: 'show the gates that worked this out',
    none: 'No gates to show'
  },
  numbers: {
    label: 'Numbers',
    icon: Binary,
    open: showNumbers,
    title: 'show what this means as numbers',
    none: 'No numbers to show'
  },
  storage: {
    label: 'Stored',
    icon: MemoryStick,
    open: showStorage,
    title: 'show the flip-flops that keep what was written',
    none: 'No register to show'
  }
};
</script>

<!--
  The way from an operation of the CPU into another topic. Where that topic has nothing to show,
  the button stays, dashed, and says why when pressed.
-->
<template>
  <Button
    v-if="unavailable === null"
    variant="outline"
    size="sm"
    class="h-7 gap-1.5 px-2 font-sans text-xs pointer-coarse:h-11"
    :aria-label="`${LINKS[topic].label}: ${LINKS[topic].title}`"
    @click="LINKS[topic].open()"
  >
    <component :is="LINKS[topic].icon" />
    {{ LINKS[topic].label }}
  </Button>
  <TapTooltip v-else v-slot="{ toggle }">
    <TooltipTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-7 cursor-help gap-1.5 border-dashed px-2 font-sans text-xs text-muted-foreground pointer-coarse:h-11"
        aria-disabled="true"
        :aria-label="`${LINKS[topic].label}. ${LINKS[topic].none}: ${unavailable}`"
        @click="toggle"
      >
        <component :is="LINKS[topic].icon" />
        {{ LINKS[topic].label }}
      </Button>
    </TooltipTrigger>
    <TooltipContent class="max-w-64 text-pretty">{{ unavailable }}</TooltipContent>
  </TapTooltip>
</template>
