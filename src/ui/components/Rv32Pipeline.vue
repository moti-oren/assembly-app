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
  STAGE_TINTS,
  type PipelineCell
} from '@/ui/rv32Pipeline';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import InfoTip from './InfoTip.vue';
import Rv32CycleToggle from './Rv32CycleToggle.vue';

const props = defineProps<{
  /** The instructions that ran, oldest first. */
  history: readonly ExecutionRecord[];
  program: Program<Instruction>;
}>();

/** The rows on show: enough to see a few instructions overlap, few enough to fit the card. */
const ROWS = 8;

const CELL_CLASSES: Record<PipelineCell['kind'], string> = {
  run: 'text-foreground',
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
      <span class="flex items-center gap-1">
        <span class="text-sm font-medium">Pipeline</span>
        <InfoTip label="About the pipeline">
          <p>
            A pipelined CPU works on five instructions at once, each in a different stage. Step or
            run the program: every instruction shows up here, cycle by cycle, with the stalls and
            flushes the overlap costs.
          </p>
          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <template v-for="stage in PIPELINE_STAGES" :key="stage">
              <dt class="rounded-sm px-1 font-mono" :class="STAGE_TINTS[stage]">{{ stage }}</dt>
              <dd class="text-muted-foreground">{{ STAGE_INFO[stage] }}</dd>
            </template>
          </dl>
        </InfoTip>
      </span>
      <Button
        variant="outline"
        size="xs"
        class="h-5 gap-1.5 rounded-full px-2 text-2xs pointer-coarse:h-11"
        :class="
          forwarding
            ? 'border-pointer/60 bg-pointer/15 text-foreground hover:bg-pointer/25 dark:border-pointer/50 dark:bg-pointer/15 dark:hover:bg-pointer/25'
            : 'border-dashed text-muted-foreground'
        "
        :aria-pressed="forwarding"
        title="Hand a result straight to the next instruction, before it is written back"
        @click="forwarding = !forwarding"
      >
        <span
          class="size-1.5 rounded-full"
          :class="forwarding ? 'bg-pointer shadow-[0_0_6px_var(--pointer)]' : 'bg-foreground/30'"
          aria-hidden="true"
        />
        Forwarding {{ forwarding ? 'on' : 'off' }}
      </Button>
      <Rv32CycleToggle class="ml-auto" />
    </div>

    <p v-if="grid.rows.length === 0" class="mt-2 text-xs leading-4 text-muted-foreground">
      Nothing has run yet.
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
                class="min-w-9 text-center font-normal"
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
                class="relative h-5 rounded-sm text-center"
                :class="[
                  cell ? CELL_CLASSES[cell.kind] : '',
                  cell?.kind === 'run' && STAGE_TINTS[cell.stage],
                  { 'inset-ring-2 inset-ring-pointer': cell?.forwarded || cell?.source }
                ]"
                :title="cell?.forwarded?.map((link) => link.text).join('; ')"
              >
                {{ cell?.stage }}
                <span v-if="cell?.kind === 'stall'" class="sr-only">(waiting)</span>
                <!-- The line a forwarded result takes: down the column, into this EX. -->
                <template v-for="link in cell?.forwarded" :key="link.text">
                  <span
                    v-if="link.rows > 0"
                    class="forward-path"
                    :style="{ '--rows': link.rows }"
                    aria-hidden="true"
                  />
                  <span class="sr-only">({{ link.text }})</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="grid.forwards" class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span class="h-0.5 w-4 rounded-full bg-pointer" aria-hidden="true" />
        Forwarded: a result handed straight to the EX below it, before it is written back.
      </p>
      <ul v-if="notes.length" class="mt-2 space-y-1 text-xs leading-4 text-muted-foreground">
        <li v-for="note in notes" :key="note">{{ note }}</li>
      </ul>
      <p class="mt-2 text-xs text-foreground">{{ summary }}</p>
    </template>
  </div>
</template>
