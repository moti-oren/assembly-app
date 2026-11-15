<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Undo2 } from '@lucide/vue';
import type { ExecutionRecord } from '@/core/execute';
import { formatInstruction } from '@/core/instructions';
import { formatLabel } from '@/core/operands';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const props = defineProps<{ history: ExecutionRecord[] }>();
defineEmits<{ undo: [] }>();

/** Running a long loop can produce thousands of records; only the latest are listed. */
const SHOWN = 200;

const shown = computed(() => {
  const start = Math.max(0, props.history.length - SHOWN);
  return props.history.slice(start).map((record, i) => ({ record, number: start + i + 1 }));
});

const list = ref<HTMLElement | null>(null);

// Keep the newest instruction in view.
watch(
  () => props.history.length,
  () => nextTick(() => list.value?.scrollTo({ top: list.value.scrollHeight })),
  { flush: 'post' }
);
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>History</CardTitle>
      <CardDescription>
        {{ history.length === 0 ? 'Nothing executed yet' : `${history.length} executed` }}
      </CardDescription>
      <CardAction>
        <Button variant="ghost" size="sm" :disabled="history.length === 0" @click="$emit('undo')">
          <Undo2 />
          Undo last
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p v-if="history.length === 0" class="text-sm text-muted-foreground">
        Every instruction you run appears here, and the last one can be undone.
      </p>
      <div v-else ref="list" class="max-h-56 overflow-y-auto rounded-lg border bg-muted/30 py-1">
        <p v-if="history.length > SHOWN" class="px-3 py-1 text-xs text-muted-foreground">
          {{ history.length - SHOWN }} earlier instructions are not shown.
        </p>
        <ol class="font-mono text-[13px]">
          <li
            v-for="{ record, number } in shown"
            :key="number"
            class="grid grid-cols-[3rem_2.75rem_1fr] items-center px-3 py-0.5"
            :class="
              number === history.length ? 'bg-background font-semibold' : 'text-foreground/75'
            "
          >
            <span class="text-right text-xs text-muted-foreground tabular-nums pr-3">{{
              number
            }}</span>
            <span class="text-xs text-muted-foreground">{{
              record.line === null ? 'now' : formatLabel(record.line)
            }}</span>
            <span class="truncate">{{ formatInstruction(record.instruction) }}</span>
          </li>
        </ol>
      </div>
    </CardContent>
  </Card>
</template>
