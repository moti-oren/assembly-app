<script setup lang="ts">
import { computed } from 'vue';
import type { Bit } from '@/core/logic/gates';
import { Button } from '@/components/ui/button';
import { gateFaultNote } from '@/ui/logicFault';
import type { DiagramGate } from '@/ui/logicSlice';
import type { LogicLens } from '@/ui/useLogicLens';

const props = defineProps<{
  lens: LogicLens;
  /** The gate picked in the drawing. */
  gate: DiagramGate;
}>();

const stuck = computed<Bit | null>(() => props.lens.faults.value[props.gate.id] ?? null);
const note = computed(() => gateFaultNote(props.gate, stuck.value, props.lens.shown.value.signals));
const VALUES: readonly Bit[] = [0, 1];
</script>

<!-- Breaks the gate picked: its output stays at 0 or at 1, whatever its inputs are. -->
<template>
  <div class="mt-3">
    <div class="toggle-group w-max" role="group" :aria-label="`Break this gate: ${gate.name}`">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-11"
        :aria-pressed="stuck === null"
        @click="lens.repairGate(gate.id)"
      >
        Works
      </Button>
      <Button
        v-for="value in VALUES"
        :key="value"
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-11"
        :aria-pressed="stuck === value"
        @click="lens.stickGate(gate.id, value)"
      >
        Stuck at {{ value }}
      </Button>
    </div>
    <!-- The region is there before its text is, or the first note would not be announced. -->
    <p class="max-w-64 text-xs text-pretty text-muted-foreground" aria-live="polite">
      <span v-if="note" class="mt-2 block">{{ note }}</span>
    </p>
  </div>
</template>
