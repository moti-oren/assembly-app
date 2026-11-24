<script setup lang="ts">
import { computed } from 'vue';
import { flagRows } from '@/ui/logicFlags';
import type { LogicLens } from '@/ui/useLogicLens';

const props = defineProps<{ lens: LogicLens }>();

const rows = computed(() => flagRows(props.lens.circuit.value, props.lens.shown.value));
</script>

<!-- Each flag, and the wire of the circuit it is read from. -->
<template>
  <div>
    <p v-if="rows.length === 0" class="text-sm text-muted-foreground">
      No flag is connected to this circuit: only the result leaves it.
    </p>
    <ul v-else class="-my-2 divide-y">
      <li v-for="row in rows" :key="row.flag" class="flex items-baseline gap-3 py-2">
        <span class="w-20 shrink-0 font-mono text-code font-semibold">{{ row.flag }}</span>
        <span
          class="logic-bit shrink-0"
          :data-tone="lens.asRun.value ? 'result' : undefined"
          :data-on="row.value ? '' : undefined"
          style="--cell: 1.875rem"
          >{{ row.value }}</span
        >
        <span class="min-w-0 text-sm text-pretty">
          {{ row.source }}
          <span v-if="row.working" class="font-mono text-xs text-muted-foreground"
            >({{ row.working }})</span
          >
        </span>
      </li>
    </ul>
    <p v-if="lens.circuit.value.note" class="mt-4 max-w-prose text-xs text-muted-foreground">
      {{ lens.circuit.value.note }}
    </p>
  </div>
</template>
