<script setup lang="ts" generic="Instruction">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import InfoTip from './InfoTip.vue';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  history: ExecutionRecord<Instruction>[];
  /** How the architecture writes an instruction. */
  format: (instruction: Instruction) => string;
  /** Undone instructions, in the order they would run again. */
  future: ExecutionRecord<Instruction>[];
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
      <CardTitle class="flex items-center gap-1">
        {{ t.history.title }}
        <InfoTip :label="t.history.about">{{ t.history.intro }}</InfoTip>
      </CardTitle>
      <CardDescription>
        <template v-if="total === 0">{{ t.history.empty }}</template>
        <template v-else-if="future.length === 0">{{
          t.history.executed(history.length)
        }}</template>
        <template v-else>{{ t.history.position(history.length, total) }}</template>
      </CardDescription>
    </CardHeader>
    <CardContent v-if="total > 0">
      <div
        ref="list"
        :style="{ '--number-column': numberColumn }"
        class="relative max-h-56 overflow-y-auto rounded-lg bg-inset py-1 lg:max-h-80"
      >
        <p v-if="history.length > SHOWN" class="px-3 py-1 text-xs text-muted-foreground">
          {{ t.history.hidden(history.length - SHOWN) }}
        </p>
        <ol class="font-mono text-code">
          <li
            v-for="{ record, number } in shown"
            :key="number"
            :data-current="number === history.length ? '' : undefined"
          >
            <button
              type="button"
              class="grid w-full grid-cols-[var(--number-column)_3.5rem_minmax(0,1fr)] content-center items-baseline px-3 py-0.5 text-start outline-none pointer-coarse:min-h-11 hover:bg-muted/60 focus-visible:bg-muted/60"
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
              <span class="pe-3 text-end text-xs text-muted-foreground tabular-nums">{{
                number
              }}</span>
              <span
                class="text-xs text-muted-foreground"
                :title="record.line === null ? t.history.directHint : undefined"
                >{{ record.line === null ? t.history.direct : formatLabel(record.line) }}</span
              >
              <span class="truncate">{{ format(record.instruction) }}</span>
            </button>
          </li>
        </ol>
      </div>
    </CardContent>
  </Card>
</template>
