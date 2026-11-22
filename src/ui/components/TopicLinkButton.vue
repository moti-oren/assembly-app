<script setup lang="ts">
import { CircuitBoard } from '@lucide/vue';
import { hasCircuit, type AluLink } from '@/core/aluLink';
import { Button } from '@/components/ui/button';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTopic } from '@/ui/useTopic';
import TapTooltip from './TapTooltip.vue';

defineProps<{
  /** Where the instruction on show leads in the logic topic. */
  link: AluLink;
}>();

const { showCircuit } = useTopic();
</script>

<!--
  The way from an operation of the CPU to the gates that worked it out. Where there is no circuit
  to show, the button stays, dashed, and says why when pressed.
-->
<template>
  <Button
    v-if="hasCircuit(link)"
    variant="outline"
    size="sm"
    class="h-7 gap-1.5 px-2 font-sans text-xs pointer-coarse:h-10"
    aria-label="Show the gates that worked this out"
    @click="showCircuit()"
  >
    <CircuitBoard />
    Gates
  </Button>
  <TapTooltip v-else v-slot="{ toggle }">
    <TooltipTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-7 cursor-help gap-1.5 border-dashed px-2 font-sans text-xs text-muted-foreground pointer-coarse:h-10"
        aria-disabled="true"
        :aria-label="`No gates to show: ${link.unavailable}`"
        @click="toggle"
      >
        <CircuitBoard />
        Gates
      </Button>
    </TooltipTrigger>
    <TooltipContent class="max-w-64 text-pretty">{{ link.unavailable }}</TooltipContent>
  </TapTooltip>
</template>
