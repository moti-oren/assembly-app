<script setup lang="ts">
import { computed } from 'vue';
import type { Program } from '@/core/shared/program';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { PIPELINE_STAGES, pipelineTiming } from '@/core/rv32/pipeline';
import type { CpuState } from '@/core/rv32/state';
import {
  pipelineGrid,
  pipelineNotes,
  pipelineSummary,
  STAGE_INFO,
  type PipelineCell
} from '@/ui/rv32Pipeline';
import { describeDecode, describeExecute, describeFetch } from '@/ui/rv32Explain';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import InfoTip from './InfoTip.vue';
import Rv32CycleToggle from './Rv32CycleToggle.vue';
import TopicLinkButton from './TopicLinkButton.vue';

const props = defineProps<{
  /** The instructions that ran, oldest first. */
  history: readonly ExecutionRecord[];
  program: Program<Instruction>;
  state: CpuState;
  /** The program line being stepped by phase, if any. */
  pending: PendingInstruction<Instruction> | null;
  /** True while the program runs on a timer: the explanation is not announced line by line. */
  running: boolean;
  /** Why the control topic has nothing to show for the last instruction: null when it has. */
  controlUnavailable: string | null | undefined;
}>();

/** The rows on show: enough to see a few instructions overlap, few enough to fit the card. */
const ROWS = 8;

const CELL_CLASSES: Record<PipelineCell['kind'], string> = {
  run: 'stage-chip',
  stall: 'border border-dashed border-foreground/50 text-muted-foreground',
  flushed: 'bg-muted text-tertiary-foreground line-through'
};

const { forwarding } = useRv32Pipeline();

const timing = computed(() =>
  pipelineTiming(props.history, props.program, { forwarding: forwarding.value })
);
const grid = computed(() => pipelineGrid(timing.value, ROWS));
const notes = computed(() =>
  pipelineNotes(timing.value, grid.value.from, { forwarding: forwarding.value })
);
const summary = computed(() => pipelineSummary(timing.value));

/** What the line on show is doing, in the words the one-by-one view gives it. */
const detail = computed(() => {
  const { pending, history, state, program } = props;
  if (pending?.phase === 'fetch') return describeFetch(pending.line, program);
  if (pending) return describeDecode(pending.instruction);
  const last = history.at(-1);
  return last ? describeExecute(last, state, program) : null;
});
</script>

<template>
  <div>
    <div class="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1.5">
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
              <dt class="stage-chip font-mono">{{ stage }}</dt>
              <dd class="text-muted-foreground">{{ STAGE_INFO[stage] }}</dd>
            </template>
          </dl>
        </InfoTip>
      </span>
      <!-- A switch drawn as one: a track and a thumb, so it reads as something to flip. -->
      <button
        type="button"
        role="switch"
        class="group/switch inline-flex h-5 items-center gap-1.5 rounded-full pr-1 text-2xs font-medium outline-none pointer-coarse:h-11 focus-visible:ring-3 focus-visible:ring-ring/50"
        :class="forwarding ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
        :aria-checked="forwarding"
        aria-describedby="forwarding-hint"
        title="Hand a result straight to the next instruction, before it is written back"
        @click="forwarding = !forwarding"
      >
        <span
          class="relative h-3.5 w-6 shrink-0 rounded-full transition-colors calm:transition-none"
          :class="forwarding ? 'bg-foreground' : 'bg-wire group-hover/switch:bg-muted-foreground'"
          aria-hidden="true"
        >
          <span
            class="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-background shadow-(--shadow-thumb) transition-transform calm:transition-none"
            :class="{ 'translate-x-2.5': forwarding }"
          />
        </span>
        Forwarding
        <!-- The title is a pointer's alone: this says the same to a screen reader. -->
        <span id="forwarding-hint" class="sr-only">
          Hand a result straight to the next instruction, before it is written back
        </span>
      </button>
      <span class="ml-auto flex items-center gap-3">
        <span v-if="controlUnavailable !== undefined" class="max-sm:hidden">
          <TopicLinkButton topic="control" :unavailable="controlUnavailable" />
        </span>
        <Rv32CycleToggle />
      </span>
    </div>

    <p
      v-if="grid.rows.length === 0 && !detail"
      class="mt-2.5 text-code leading-5 text-muted-foreground max-sm:mt-1.5"
    >
      Nothing has run yet.
    </p>
    <template v-else-if="grid.rows.length > 0">
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
                  cell?.kind === 'run' && row.newest && 'stage-chip-active',
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
    <!-- The chart says when; this says what the last instruction did, as the other view does. -->
    <p
      v-if="detail"
      class="mt-2 text-code leading-5 text-muted-foreground"
      aria-live="polite"
      :aria-busy="running"
    >
      {{ detail }}
    </p>
  </div>
</template>
