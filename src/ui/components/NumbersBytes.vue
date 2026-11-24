<script setup lang="ts">
import { computed } from 'vue';
import type { ByteOrder } from '@/core/representation/bytes';
import type { Width } from '@/core/representation/readings';
import { Button } from '@/components/ui/button';
import { BYTE_ORDERS, byteCells, misreadText, orderLesson } from '@/ui/numbersBytes';

const props = defineProps<{
  value: number;
  width: Width;
}>();
/** Which end of the value is at the lowest address. */
const order = defineModel<ByteOrder>('order', { required: true });

const cells = computed(() => byteCells(props.value, props.width, order.value));
</script>

<!-- The value as the bytes it takes up in memory, the lowest address on the left. -->
<template>
  <section aria-label="The value in memory">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h3 class="text-sm font-semibold">In memory</h3>
      <div v-if="width > 8" class="toggle-group" role="group" aria-label="Which byte comes first">
        <Button
          v-for="choice in BYTE_ORDERS"
          :key="choice.id"
          variant="ghost"
          size="sm"
          class="h-7 px-2.5 text-xs pointer-coarse:h-11 pointer-coarse:min-w-11"
          :aria-pressed="order === choice.id"
          @click="order = choice.id"
        >
          {{ choice.label }}
        </Button>
      </div>
    </div>

    <p v-if="width === 8" class="mt-2 max-w-prose text-sm text-pretty text-muted-foreground">
      A single byte takes one address, so it has no order. Make the value 16 or 32 bits wide to see
      its bytes set out.
    </p>
    <template v-else>
      <p class="mt-2 max-w-prose text-sm text-pretty text-muted-foreground">
        {{ orderLesson(order) }}
      </p>
      <ol class="mt-3 grid max-w-96 grid-cols-4 gap-2" aria-label="Bytes, from the lowest address">
        <li
          v-for="cell in cells"
          :key="cell.address"
          class="flex min-w-0 flex-col items-center rounded-md border px-1 py-2"
        >
          <span class="font-mono text-xs text-muted-foreground">{{ cell.address }}</span>
          <span class="font-mono text-lg font-semibold tabular-nums">{{ cell.hex }}</span>
          <span class="text-xs text-muted-foreground" :class="{ 'font-semibold': cell.low }">
            {{ cell.bits }}
          </span>
        </li>
      </ol>
      <p class="mt-3 max-w-prose text-sm text-pretty">
        {{ misreadText(value, width) }}
      </p>
    </template>
  </section>
</template>
