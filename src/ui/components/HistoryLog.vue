<script setup lang="ts" generic="Instruction">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import InfoTip from './InfoTip.vue';

const props = defineProps<{
  history: ExecutionRecord<Instruction>[];
  /** How the architecture writes an instruction. */
  format: (instruction: Instruction) => string;
  /** Undone instructions, in the order they would run again. */
  future: ExecutionRecord<Instruction>[];
  /** While a run goes, new rows come in without easing: at speed they would only flicker. */
  running?: boolean;
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
      <!-- On a phone the title row is as tall as the other panels' titles, on the chevron's line. -->
      <CardTitle role="heading" aria-level="2" class="flex items-center gap-1 max-md:h-5">
        History
        <InfoTip label="About the history">
          Every instruction you run appears here. Pick one to go back to the moment after it ran.
        </InfoTip>
      </CardTitle>
      <CardDescription>
        <template v-if="total === 0">Nothing executed yet</template>
        <template v-else-if="future.length === 0">{{ history.length }} executed</template>
        <template v-else>At {{ history.length }} of {{ total }}</template>
      </CardDescription>
    </CardHeader>
    <CardContent v-if="total > 0">
      <div
        ref="list"
        data-fill
        :style="{ '--number-column': numberColumn }"
        class="relative max-h-56 well overflow-y-auto rounded-lg py-1 lg:max-h-80"
      >
        <p v-if="history.length > SHOWN" class="px-3 py-1 text-xs text-muted-foreground">
          {{ history.length - SHOWN }} earlier instructions are not shown.
        </p>
        <ol class="font-mono text-code" :data-running="running ? '' : undefined">
          <template v-for="{ record, number } in shown" :key="number">
            <!-- Where the undone part begins: its rows are greyed, which alone is hard to see. -->
            <li
              v-if="number === history.length + 1"
              class="border-t border-dashed px-3 pt-1 font-sans text-2xs text-muted-foreground"
            >
              Undone: Redo runs these again
            </li>
            <li class="row-arrive" :data-current="number === history.length ? '' : undefined">
              <button
                type="button"
                class="grid w-full grid-cols-[var(--number-column)_3.5rem_minmax(0,1fr)] content-center items-baseline px-3 py-0.5 text-left outline-none min-h-6 pointer-coarse:min-h-11 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                :class="
                  number === history.length
                    ? 'bg-background font-semibold'
                    : number > history.length
                      ? 'text-tertiary-foreground'
                      : 'text-muted-foreground'
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
                <span class="truncate">{{ format(record.instruction) }}</span>
              </button>
            </li>
          </template>
        </ol>
      </div>
    </CardContent>
  </Card>
</template>
