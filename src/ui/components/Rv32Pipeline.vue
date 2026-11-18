<script setup lang="ts">
import { computed } from 'vue';
import type { Program } from '@/core/shared/program';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { PIPELINE_STAGES, pipelineTiming } from '@/core/rv32/pipeline';
import { Button } from '@/components/ui/button';
import {
  pipelineGrid,
  pipelineNotes,
  pipelineSummary,
  STAGE_INFO,
  type PipelineCell
} from '@/ui/rv32Pipeline';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import Rv32CycleToggle from './Rv32CycleToggle.vue';

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
const grid = computed(() => pipelineGrid(timing.value, ROWS));
const notes = computed(() => pipelineNotes(timing.value, grid.value.from));
const summary = computed(() => pipelineSummary(timing.value));
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span class="text-sm font-medium">Pipeline</span>
      <Button
        variant="outline"
        size="xs"
        class="h-5 px-1.5 text-2xs pointer-coarse:h-11"
        :aria-pressed="forwarding"
        title="Hand a result straight to the next instruction, before it is written back"
        @click="forwarding = !forwarding"
      >
        Forwarding {{ forwarding ? 'on' : 'off' }}
      </Button>
      <Rv32CycleToggle class="ml-auto" />
    </div>

    <p v-if="grid.rows.length === 0" class="mt-2 text-xs leading-4 text-muted-foreground">
      A pipelined CPU works on five instructions at once, each in a different stage. Step or run the
      program: every instruction shows up here, cycle by cycle, with the stalls and flushes the
      overlap costs.
    </p>
    <template v-else>
      <div class="mt-2 overflow-x-auto">
        <table class="border-separate border-spacing-0.5 font-mono text-2xs">
          <thead>
            <tr class="text-muted-foreground">
              <th scope="col" class="pr-2 text-left font-sans font-normal">Cycle</th>
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
                class="max-w-48 truncate pr-2 text-left font-normal"
                :class="row.flushed ? 'text-muted-foreground line-through' : 'text-foreground'"
              >
                <span class="text-muted-foreground">{{ row.label }}</span>
                {{ row.text }}
                <span v-if="row.flushed" class="sr-only">(flushed)</span>
                <span v-if="row.newest" class="text-pointer" title="The last instruction run">
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
                <span v-if="cell?.kind === 'stall'" class="sr-only">(waiting)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul v-if="notes.length" class="mt-2 space-y-1 text-xs leading-4 text-muted-foreground">
        <li v-for="note in notes" :key="note">{{ note }}</li>
      </ul>
      <p class="mt-2 text-xs text-foreground">{{ summary }}</p>
    </template>

    <dl class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
      <div v-for="stage in PIPELINE_STAGES" :key="stage" class="flex gap-1">
        <dt class="font-mono text-foreground">{{ stage }}</dt>
        <dd>{{ STAGE_INFO[stage] }}</dd>
      </div>
    </dl>
  </div>
</template>
