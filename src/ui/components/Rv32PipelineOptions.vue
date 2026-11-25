<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { isPredictor, predictorLabel, PREDICTOR_INFO, PREDICTOR_OPTIONS } from '@/ui/rv32Pipeline';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';

const { forwarding, predictor } = useRv32Pipeline();

/** The select hands back whatever value its item had; only a known predictor gets through. */
function setPredictor(value: unknown): void {
  if (isPredictor(value)) predictor.value = value;
}
</script>

<!-- What the pipeline on show is built with: forwarding, and the branch predictor. -->
<template>
  <!-- A switch drawn as one: a track and a thumb, so it reads as something to flip. -->
  <button
    type="button"
    role="switch"
    class="group/switch inline-flex h-5 items-center gap-1.5 rounded-full pr-1 text-2xs font-medium outline-none pointer-coarse:h-11 focus-visible:ring-3 focus-visible:ring-ring/50"
    :class="forwarding ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
    :aria-checked="forwarding"
    aria-describedby="forwarding-hint"
    title="Hand a result straight to the next instruction, before it is written back"
    @click="forwarding = !forwarding"
  >
    <span
      class="relative h-3.5 w-6 shrink-0 rounded-full transition-colors calm:transition-none"
      :class="forwarding ? 'bg-foreground' : 'bg-wire group-hover/switch:bg-muted-foreground'"
      aria-hidden="true"
    >
      <span
        class="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-background shadow-(--shadow-thumb) transition-transform calm:transition-none"
        :class="{ 'translate-x-2.5': forwarding }"
      />
    </span>
    Forwarding
    <!-- The title is a pointer's alone: this says the same to a screen reader. -->
    <span id="forwarding-hint" class="sr-only">
      Hand a result straight to the next instruction, before it is written back
    </span>
  </button>
  <!-- A menu, not a row of buttons: the view toggle beside it stays the header's one switch. -->
  <Select :model-value="predictor" @update:model-value="setPredictor">
    <SelectTrigger
      size="sm"
      class="h-5 gap-1 border-0 bg-transparent px-1 text-2xs font-medium shadow-none data-[size=sm]:h-5 pointer-coarse:data-[size=sm]:h-11 dark:bg-transparent"
      :aria-label="`Branch predictor: ${predictorLabel(predictor)}`"
      aria-describedby="predictor-hint"
      :title="PREDICTOR_INFO[predictor]"
    >
      <SelectValue>
        <span class="text-muted-foreground">Predictor</span>
        {{ predictorLabel(predictor) }}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="option in PREDICTOR_OPTIONS" :key="option.value" :value="option.value">
        <span class="flex flex-col">
          {{ option.label }}
          <span class="text-xs text-muted-foreground">{{ PREDICTOR_INFO[option.value] }}</span>
        </span>
      </SelectItem>
    </SelectContent>
  </Select>
  <span id="predictor-hint" class="sr-only">{{ PREDICTOR_INFO[predictor] }}</span>
</template>
