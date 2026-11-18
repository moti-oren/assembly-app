<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction } from '@/core/x86/instructions';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const props = defineProps<{
  history: ExecutionRecord[];
  /** Undone instructions, in the order they would run again. */
  future: ExecutionRecord[];
}>();
const emit = defineEmits<{ seek: [position: number] }>();

/** Running a long loop can produce thousands of records; only the nearest are listed. */
const SHOWN = 200;

const shown = computed(() => {
  const start = Math.max(0, props.history.length - SHOWN);
  const past = props.history.slice(start).map((record, i) => ({ record, number: start + i + 1 }));
  const ahead = props.future
    .slice(0, SHOWN)
    .map((record, i) => ({ record, number: props.history.length + i + 1 }));
  return [...past, ...ahead];
});

const total = computed(() => props.history.length + props.future.length);

/** Every row is its own grid, so the number column is sized once, for the largest number. */
const numberColumn = computed(() => `max(3rem, calc(${String(total.value).length}ch + 0.75rem))`);

const list = ref<HTMLElement | null>(null);

// Keep the instruction the CPU is at in view.
function showCurrent(): void {
  const lines = list.value;
  if (!lines) return;
  const current = lines.querySelector<HTMLElement>('[data-current]');
  lines.scrollTo({
    top: current ? current.offsetTop + current.offsetHeight - lines.clientHeight + 8 : 0
  });
}

onMounted(showCurrent);
watch(
  () => [props.history.length, props.future.length],
  () => nextTick(showCurrent),
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
    </CardHeader>
    <CardContent>
      <p v-if="total === 0" class="text-sm text-muted-foreground">
        Every instruction you run appears here. Pick one to go back to the moment after it ran.
      </p>
      <div
        v-else
        ref="list"
        :style="{ '--number-column': numberColumn }"
        class="relative max-h-56 overflow-y-auto rounded-lg border bg-muted/30 py-1 lg:max-h-80"
      >
        <p v-if="history.length > SHOWN" class="px-3 py-1 text-xs text-muted-foreground">
          {{ history.length - SHOWN }} earlier instructions are not shown.
        </p>
        <ol class="font-mono text-code">
          <li
            v-for="{ record, number } in shown"
            :key="number"
            :data-current="number === history.length ? '' : undefined"
          >
            <button
              type="button"
              class="grid w-full grid-cols-[var(--number-column)_3.5rem_minmax(0,1fr)] content-center items-baseline px-3 py-0.5 text-left outline-none pointer-coarse:min-h-11 hover:bg-muted/60 focus-visible:bg-muted/60"
              :class="
                number === history.length
                  ? 'bg-background font-semibold'
                  : number > history.length
                    ? 'text-muted-foreground'
                    : 'text-foreground/75'
              "
              :aria-current="number === history.length ? 'step' : undefined"
              @click="emit('seek', number)"
            >
              <span class="pr-3 text-right text-xs text-muted-foreground tabular-nums">{{
                number
              }}</span>
              <span
                class="text-xs text-muted-foreground"
                :title="
                  record.line === null ? 'Run from the builder, not from the program' : undefined
                "
                >{{ record.line === null ? 'direct' : formatLabel(record.line) }}</span
              >
              <span class="truncate">{{ formatInstruction(record.instruction) }}</span>
            </button>
          </li>
        </ol>
      </div>
    </CardContent>
  </Card>
</template>
