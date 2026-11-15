<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Redo2, Undo2 } from '@lucide/vue';
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

const props = defineProps<{
  history: ExecutionRecord[];
  /** Undone instructions, in the order they would run again. */
  future: ExecutionRecord[];
}>();
const emit = defineEmits<{ undo: []; redo: []; seek: [position: number] }>();

/** Running a long loop can produce thousands of records; only the latest are listed. */
const SHOWN = 200;

const shown = computed(() => {
  const start = Math.max(0, props.history.length - SHOWN);
  return props.history.slice(start).map((record, i) => ({ record, number: start + i + 1 }));
});

const shownFuture = computed(() =>
  props.future
    .slice(0, SHOWN)
    .map((record, i) => ({ record, number: props.history.length + i + 1 }))
);

const total = computed(() => props.history.length + props.future.length);

const list = ref<HTMLElement | null>(null);

// Keep the instruction the CPU is at in view.
watch(
  () => [props.history.length, props.future.length],
  () =>
    nextTick(() => {
      const lines = list.value;
      const current = lines?.querySelector<HTMLElement>('[data-current]');
      if (!lines) return;
      lines.scrollTo({
        top: current ? current.offsetTop + current.offsetHeight - lines.clientHeight + 8 : 0
      });
    }),
  { flush: 'post' }
);
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>History</CardTitle>
      <CardDescription>
        <template v-if="total === 0">Nothing executed yet</template>
        <template v-else-if="future.length === 0">{{ history.length }} executed</template>
        <template v-else>At {{ history.length }} of {{ total }}</template>
      </CardDescription>
      <CardAction class="flex items-center gap-1">
        <Button variant="ghost" size="sm" :disabled="history.length === 0" @click="emit('undo')">
          <Undo2 />
          Undo
        </Button>
        <Button variant="ghost" size="sm" :disabled="future.length === 0" @click="emit('redo')">
          <Redo2 />
          Redo
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <p v-if="total === 0" class="text-sm text-muted-foreground">
        Every instruction you run appears here. Drag the timeline to move back and forth through
        them.
      </p>
      <input
        v-else
        type="range"
        class="h-4 w-full cursor-pointer accent-pointer"
        min="0"
        :max="total"
        :value="history.length"
        aria-label="Move through the executed instructions"
        @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
      />
      <div
        v-if="total > 0"
        ref="list"
        class="relative max-h-56 overflow-y-auto rounded-lg border bg-muted/30 py-1"
      >
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
            :data-current="number === history.length ? '' : undefined"
          >
            <span class="text-right text-xs text-muted-foreground tabular-nums pr-3">{{
              number
            }}</span>
            <span class="text-xs text-muted-foreground">{{
              record.line === null ? 'now' : formatLabel(record.line)
            }}</span>
            <span class="truncate">{{ formatInstruction(record.instruction) }}</span>
          </li>
          <li
            v-for="{ record, number } in shownFuture"
            :key="number"
            class="grid grid-cols-[3rem_2.75rem_1fr] items-center px-3 py-0.5 text-foreground/35"
          >
            <span class="pr-3 text-right text-xs tabular-nums">{{ number }}</span>
            <span class="text-xs">{{
              record.line === null ? 'now' : formatLabel(record.line)
            }}</span>
            <span class="truncate">{{ formatInstruction(record.instruction) }}</span>
          </li>
        </ol>
      </div>
    </CardContent>
  </Card>
</template>
