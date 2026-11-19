<script setup lang="ts">
import { computed } from 'vue';
import type { Program } from '@/core/shared/program';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { PIPELINE_STAGES, pipelineTiming } from '@/core/rv32/pipeline';
import { Button } from '@/components/ui/button';
import { pipelineGrid, pipelineNotes, pipelineSummary, type PipelineCell } from '@/ui/rv32Pipeline';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import InfoTip from './InfoTip.vue';
import Rv32CycleToggle from './Rv32CycleToggle.vue';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  /** The instructions that ran, oldest first. */
  history: readonly ExecutionRecord[];
  program: Program<Instruction>;
}>();

/** The rows on show: enough to see a few instructions overlap, few enough to fit the card. */
const ROWS = 8;

const CELL_CLASSES: Record<PipelineCell['kind'], string> = {
  run: 'bg-foreground/10 text-foreground',
  stall: 'border border-dashed border-changed-foreground/60 bg-changed/40 text-changed-foreground',
  flushed: 'bg-muted text-muted-foreground/70 line-through'
};

const { forwarding } = useRv32Pipeline();

const timing = computed(() =>
  pipelineTiming(props.history, props.program, { forwarding: forwarding.value })
);
const grid = computed(() => pipelineGrid(t.value, timing.value, ROWS));
const notes = computed(() => pipelineNotes(t.value, timing.value, grid.value.from));
const summary = computed(() => pipelineSummary(t.value, timing.value));
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span class="flex items-center gap-1">
        <span class="text-sm font-medium">{{ t.rv32.pipeline.title }}</span>
        <InfoTip :label="t.rv32.pipeline.about">
          <p>{{ t.rv32.pipeline.intro }}</p>
          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <template v-for="stage in PIPELINE_STAGES" :key="stage">
              <dt class="font-mono">{{ stage }}</dt>
              <dd class="text-muted-foreground">{{ t.rv32.pipeline.stages[stage] }}</dd>
            </template>
          </dl>
        </InfoTip>
      </span>
      <Button
        variant="outline"
        size="xs"
        class="h-5 px-1.5 text-2xs pointer-coarse:h-11"
        :aria-pressed="forwarding"
        :title="t.rv32.pipeline.forwardingHint"
        @click="forwarding = !forwarding"
      >
        {{ t.rv32.pipeline.forwarding(forwarding) }}
      </Button>
      <Rv32CycleToggle class="ms-auto" />
    </div>

    <p v-if="grid.rows.length === 0" class="ui-text mt-2 text-xs leading-4 text-muted-foreground">
      {{ t.cycle.nothingYet }}
    </p>
    <template v-else>
      <div dir="ltr" class="mt-2 overflow-x-auto">
        <table class="border-separate border-spacing-0.5 font-mono text-2xs">
          <thead>
            <tr class="text-muted-foreground">
              <th scope="col" class="pe-2 text-start font-sans font-normal">
                {{ t.rv32.pipeline.cycle }}
              </th>
              <th
                v-for="cycle in grid.cycles"
                :key="cycle"
                scope="col"
                class="min-w-8 text-center font-normal tabular-nums"
              >
                {{ cycle }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in grid.rows" :key="row.key">
              <th
                scope="row"
                class="max-w-48 truncate pe-2 text-start font-normal"
                :class="row.flushed ? 'text-muted-foreground line-through' : 'text-foreground'"
              >
                <span class="text-muted-foreground">{{ row.label }}</span>
                {{ row.text }}
                <span v-if="row.flushed" class="sr-only">{{ t.rv32.pipeline.flushed }}</span>
                <span v-if="row.newest" class="text-pointer" :title="t.rv32.pipeline.newest">
                  ◂
                </span>
              </th>
              <td
                v-for="(cell, index) in row.cells"
                :key="index"
                class="h-5 rounded-sm text-center"
                :class="cell ? CELL_CLASSES[cell.kind] : ''"
              >
                {{ cell?.stage }}
                <span v-if="cell?.kind === 'stall'" class="sr-only">{{
                  t.rv32.pipeline.waiting
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul
        v-if="notes.length"
        class="ui-text mt-2 space-y-1 text-xs leading-4 text-muted-foreground"
      >
        <li v-for="note in notes" :key="note">{{ note }}</li>
      </ul>
      <p class="ui-text mt-2 text-xs text-foreground">{{ summary }}</p>
    </template>
  </div>
</template>
