<script setup lang="ts">
import { CYCLE_PHASES, type CyclePhase } from '@/core/shared/cycle';
import InfoTip from './InfoTip.vue';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

defineProps<{
  /** The phase the instruction on show is in, or null before anything has run. */
  active: CyclePhase | null;
  /** The instruction on show, as written, or null when the CPU is idle. */
  instruction: string | null;
  /** What happens in that phase, in words; null before anything has run. */
  detail: string | null;
  /** How the cycle works on this CPU, behind the info button. */
  intro: string;
}>();

const PHASE_LABELS: Record<CyclePhase, string> = {
  fetch: 'Fetch',
  decode: 'Decode',
  execute: 'Execute'
};
</script>

<template>
  <div>
    <div class="flex items-center gap-3">
      <span class="-me-2 text-sm font-medium">{{ t.cycle.title }}</span>
      <InfoTip :label="t.cycle.about">{{ intro }}</InfoTip>
      <ol class="flex items-center gap-1 text-xs" :aria-label="t.cycle.phases">
        <li
          v-for="(phase, index) in CYCLE_PHASES"
          :key="phase"
          class="flex items-center gap-1"
          :aria-current="phase === active ? 'step' : undefined"
        >
          <span
            v-if="index > 0"
            class="h-0.5 w-3 rounded-full bg-foreground/15"
            aria-hidden="true"
          />
          <span
            class="rounded-md border px-2 py-0.5 transition-colors duration-300"
            :class="
              phase === active
                ? 'border-transparent bg-foreground font-semibold text-background'
                : 'text-muted-foreground'
            "
            >{{ PHASE_LABELS[phase] }}</span
          >
        </li>
      </ol>
      <span class="ms-auto truncate font-mono text-xs text-muted-foreground">{{
        instruction ?? t.cycle.idle
      }}</span>
      <!-- Controls an architecture adds to its own cycle card. -->
      <slot name="actions" />
    </div>
    <!-- Three lines, whatever the text, so the panels below never move until it is opened. -->
    <details class="group mt-2 text-xs leading-4 text-muted-foreground">
      <summary
        class="line-clamp-3 h-12 cursor-pointer list-none rounded-sm outline-none group-open:line-clamp-none group-open:h-auto focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
      >
        <span class="ui-text block" aria-live="polite">{{ detail ?? t.cycle.nothingYet }}</span>
      </summary>
    </details>
  </div>
</template>
