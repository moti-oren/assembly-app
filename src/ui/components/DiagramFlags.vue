<script setup lang="ts">
import { FLAG_INFO, FLAG_NAMES } from '@/core/x86/flags';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import FlagReason from './FlagReason.vue';
import RollingDigits from './RollingDigits.vue';
import { useLocale } from '@/ui/useLocale';

defineProps<{
  model: CpuDiagramModel;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
}>();
const { t } = useLocale();
</script>

<template>
  <span
    class="ml-[calc(50%-0.625rem)] hidden h-3 w-0.5 transition-colors duration-300 sm:block"
    :class="model.changedFlags !== 0 ? 'bg-written' : 'bg-foreground/15'"
    aria-hidden="true"
  />

  <!-- Nine in a row only where the diagram is wide; on a phone they take two rows. -->
  <div class="mt-3 grid grid-cols-5 gap-1 sm:mt-0 sm:mr-5 sm:grid-cols-9">
    <Tooltip v-for="flag in FLAG_NAMES" :key="flag">
      <TooltipTrigger as-child>
        <div
          tabindex="0"
          class="change-mark flex cursor-help flex-col items-center rounded-md border px-0 py-1 font-mono outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          :class="[
            model.flagChanged(flag)
              ? 'border-transparent bg-changed text-changed-foreground'
              : model.isSet(flag)
                ? 'border-foreground/20 bg-secondary'
                : 'border-border bg-card'
          ]"
          :aria-label="t.flags.value(FLAG_INFO[flag].label, model.isSet(flag) ? 1 : 0)"
        >
          <span
            v-if="model.flagChanged(flag)"
            :key="tick"
            class="change-flash"
            aria-hidden="true"
          />
          <span class="text-2xs font-semibold">{{ flag }}</span>
          <span class="text-sm" :class="model.isSet(flag) ? 'font-bold' : 'text-muted-foreground'"
            ><RollingDigits effect="flip" :text="model.isSet(flag) ? '1' : '0'"
          /></span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <FlagReason :flag="flag" :record="model.record" />
      </TooltipContent>
    </Tooltip>
  </div>
</template>
