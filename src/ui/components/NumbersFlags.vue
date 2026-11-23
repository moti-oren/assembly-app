<script setup lang="ts">
import { computed } from 'vue';
import { flagRows } from '@/ui/numbersFlags';
import type { NumberLens } from '@/ui/useNumberLens';

const props = defineProps<{ lens: NumberLens }>();

const rows = computed(() => flagRows(props.lens.view.value, props.lens.solution.value));
</script>

<!-- Each flag, and what it says about the numbers. -->
<template>
  <section aria-label="Flags">
    <h3 class="text-sm font-semibold">
      {{ lens.followsCpu.value ? 'What each flag says' : 'What a CPU would note' }}
    </h3>
    <p v-if="rows.length === 0" class="mt-2 text-sm text-muted-foreground">
      Nothing is noted about this operation: only the result is kept.
    </p>
    <ul v-else class="mt-2 divide-y">
      <li v-for="row in rows" :key="row.flag" class="flex items-baseline gap-3 px-1.5 py-2">
        <span class="w-20 shrink-0 font-mono text-code font-semibold">{{ row.flag }}</span>
        <span
          class="logic-bit shrink-0"
          :data-tone="lens.asRun.value ? 'result' : undefined"
          :data-on="row.value ? '' : undefined"
          style="--cell: 1.875rem"
          >{{ row.value }}</span
        >
        <span class="min-w-0 text-sm text-pretty">{{ row.meaning }}</span>
      </li>
    </ul>
    <p v-if="lens.view.value.note" class="mt-3 max-w-prose text-xs text-muted-foreground">
      {{ lens.view.value.note }}
    </p>
  </section>
</template>
