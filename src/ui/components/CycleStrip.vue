<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { CYCLE_PHASES, type CyclePhase } from '@/core/shared/cycle';
import InfoTip from './InfoTip.vue';

const props = defineProps<{
  /** The phase the instruction on show is in, or null before anything has run. */
  active: CyclePhase | null;
  /** The instruction on show, as written, or null when the CPU is idle. */
  instruction: string | null;
  /** What happens in that phase, in words; null before anything has run. */
  detail: string | null;
  /** How the cycle works on this CPU, behind the info button. */
  intro: string;
}>();

/** True once the phase on show is at or past the one at `index`. */
function reached(index: number): boolean {
  return props.active !== null && CYCLE_PHASES.indexOf(props.active) >= index;
}

const summary = useTemplateRef<HTMLElement>('summary');
const open = ref(false);
/** Whether the text is cut off at three lines; only then is there anything to open. */
const truncated = ref(false);

function measure(): void {
  const text = summary.value;
  if (text && !open.value) truncated.value = text.scrollHeight > text.clientHeight + 1;
}

useResizeObserver(summary, measure);
watch(
  () => props.detail,
  () => nextTick(measure),
  { flush: 'post' }
);

/** A click that would open nothing must not change the card's height. */
function onSummaryClick(event: MouseEvent): void {
  if (!truncated.value && !open.value) event.preventDefault();
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  fetch: 'Fetch',
  decode: 'Decode',
  execute: 'Execute'
};
</script>

<template>
  <div>
    <!-- A phone has no room for an architecture's controls beside the phases: they take a row. -->
    <div
      class="flex items-center gap-3 max-sm:gap-2"
      :class="{ 'max-sm:flex-wrap max-sm:gap-y-1': $slots.actions }"
    >
      <span class="-mr-2 text-sm font-medium max-sm:-mr-1">Cycle</span>
      <InfoTip label="About the instruction cycle">{{ intro }}</InfoTip>
      <ol class="flex shrink-0 items-center gap-1 text-xs" aria-label="Instruction cycle">
        <li
          v-for="(phase, index) in CYCLE_PHASES"
          :key="phase"
          class="flex items-center gap-1"
          :aria-current="phase === active ? 'step' : undefined"
        >
          <span
            v-if="index > 0"
            class="w-4 border-t transition-colors duration-300 max-sm:w-3"
            :class="reached(index) ? 'border-pointer/70' : 'border-foreground/15'"
            aria-hidden="true"
          />
          <!--
            The phase on show is filled; the ones already behind it keep an outline. On a phone
            the others are only their number, in a circle.
          -->
          <span
            class="flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 transition-colors duration-300 max-sm:h-6"
            :class="[
              phase === active ? '' : 'max-sm:w-6 max-sm:justify-center max-sm:gap-0 max-sm:p-0',
              phase === active
                ? 'border-transparent bg-pointer font-semibold text-pointer-foreground shadow-[0_0_14px_-3px_var(--pointer)]'
                : reached(index + 1)
                  ? 'border-pointer/45 bg-pointer/10 text-foreground'
                  : 'text-muted-foreground'
            ]"
          >
            <span
              class="grid size-4 place-items-center rounded-full bg-current/15 font-mono text-2xs"
              :class="{ 'max-sm:bg-transparent': phase !== active }"
              aria-hidden="true"
              >{{ index + 1 }}</span
            >
            <!-- A phone has room to name one phase: the one on show. The others keep their number. -->
            <span :class="{ 'max-sm:sr-only': phase !== active }">{{ PHASE_LABELS[phase] }}</span>
            <span v-if="phase !== active && reached(index + 1)" class="sr-only">(done)</span>
          </span>
        </li>
      </ol>
      <span v-if="$slots.actions" class="hidden basis-full max-sm:block" aria-hidden="true" />
      <span
        class="ml-auto min-w-0 truncate font-mono text-xs text-muted-foreground"
        :class="{ 'max-sm:ml-0 max-sm:flex-1': $slots.actions }"
        >{{ instruction ?? 'idle' }}</span
      >
      <!-- Controls an architecture adds to its own cycle card. -->
      <slot name="actions" />
    </div>
    <!--
      Three lines (two on a low window or a phone), whatever the text, so the panels below never
      move until it is opened. A phone gives the idle line no more room than it takes.
    -->
    <details
      class="group mt-2.5 text-code leading-5 text-muted-foreground max-sm:mt-1.5"
      @toggle="open = ($event.target as HTMLDetailsElement).open"
    >
      <summary
        ref="summary"
        class="line-clamp-3 h-15 list-none short:line-clamp-2 short:h-10 rounded-sm outline-none max-sm:line-clamp-2 group-open:line-clamp-none group-open:h-auto focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:group-open:line-clamp-none max-sm:group-open:h-auto [&::-webkit-details-marker]:hidden"
        :class="[
          detail === null ? 'max-sm:h-5' : 'max-sm:h-10',
          { 'cursor-pointer': truncated || open }
        ]"
        @click="onSummaryClick"
      >
        <span aria-live="polite">{{ detail ?? 'Nothing has run yet.' }}</span>
      </summary>
    </details>
  </div>
</template>
