<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ValueRequest, ValueSolution } from '@/core/representation/request';
import { bitsOf } from '@/ui/numbersView';
import { valueRows } from '@/ui/numbersValue';
import type { NumberLens } from '@/ui/useNumberLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{
  lens: NumberLens;
  request: ValueRequest;
  solution: ValueSolution;
}>();

useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.request.width);

const rows = computed(() => valueRows(props.solution.readings));
</script>

<!-- One row of bits, and everything it can be taken to mean. -->
<template>
  <div ref="rows" class="logic-rows">
    <LogicBitNumbers :width="request.width" />
    <LogicRow
      label="Bits"
      name="The value"
      mode="flip"
      :bits="bitsOf(request.bits, request.width)"
      @flip="lens.flipBit('a', $event)"
    />
  </div>
  <dl class="mt-3 divide-y text-sm" aria-live="polite">
    <div
      v-for="row in rows"
      :key="row.name"
      class="flex flex-wrap items-baseline gap-x-3 px-1.5 py-2"
    >
      <dt class="w-28 shrink-0 font-semibold">{{ row.name }}</dt>
      <dd class="font-mono tabular-nums" :class="{ 'text-muted-foreground': row.none }">
        {{ row.value }}
      </dd>
      <dd class="min-w-0 basis-full text-xs text-pretty text-muted-foreground sm:basis-auto">
        {{ row.how }}
      </dd>
    </div>
  </dl>
</template>
