<script setup lang="ts">
import { computed } from 'vue';
import { formatPhysical } from '@/core/x86/address';
import { formatBinary, formatHex, toSigned } from '@/core/shared/numbers';
import { REGISTER_DESCRIPTIONS, type WordRegister } from '@/core/x86/registers';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import { usePreferences } from '@/ui/usePreferences';
import ChangeMark from './ChangeMark.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  model: CpuDiagramModel;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
}>();

const { registerBits } = usePreferences();

/** The bus interface unit holds what an address is made of: the segments and IP. */
const BIU_REGISTERS: readonly WordRegister[] = ['cs', 'ds', 'ss', 'es', 'ip'];
/** The sum the adder is showing, with the segment it starts from; null while it has none. */
const adder = computed(() =>
  props.model.memory && props.model.address
    ? { ...props.model.address, name: props.model.memory.segment.toUpperCase() }
    : null
);

/** IP starts a group of its own. */
const GROUP_START: WordRegister = 'ip';
</script>

<template>
  <!-- As wide as its register rows, with or without their bits; the adder's notes wrap. -->
  <section class="flex flex-col sm:w-(--biu-width)" aria-label="Bus interface unit">
    <h3 class="unit-title sm:pl-7">Bus interface unit <span>BIU</span></h3>
    <div class="flex flex-col font-mono text-code">
      <div
        class="mb-1 flex h-5 items-center gap-2.5 border-b font-sans text-xs text-muted-foreground"
      >
        <span class="-mr-0.5 hidden w-5 sm:block" />
        <span class="w-6" />
        <span class="w-10">Hex</span>
        <span class="flex w-11 justify-end whitespace-nowrap">Decimal</span>
        <span v-if="registerBits" class="hidden @min-[40rem]:inline">Binary</span>
      </div>
      <div
        v-for="name in BIU_REGISTERS"
        :key="name"
        class="flex h-5 items-center gap-2.5"
        :class="{ 'mt-1.5': name === GROUP_START }"
      >
        <DiagramWire
          class="-mr-0.5 hidden w-5 sm:block"
          :kind="model.use(name)"
          :tick="model.pulse"
        />
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="w-6 cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
              >{{ name.toUpperCase() }}</span
            >
          </TooltipTrigger>
          <TooltipContent side="left">{{ REGISTER_DESCRIPTIONS[name] }}</TooltipContent>
        </Tooltip>
        <span class="w-10">
          <ChangeMark
            :on="model.changedBits(name) !== 0"
            :written="model.wrote(name)"
            :tick="tick"
            :data-loc="`reg:${name}`"
          >
            <RollingDigits :text="formatHex(model.value(name), 16)" />
          </ChangeMark>
        </span>
        <span
          class="w-11 text-right text-xs text-muted-foreground tabular-nums"
          :title="`${model.value(name)} unsigned, ${toSigned(model.value(name), 16)} signed`"
        >
          <RollingDigits :text="String(model.value(name))" />
        </span>
        <!-- Only where both units fit their bits side by side; the EU's bits come first. -->
        <span v-if="registerBits" class="hidden text-2xs @min-[40rem]:inline">
          <RollingDigits
            effect="flip"
            dim-zeros
            :text="formatBinary(model.value(name), 16)"
            :marks="formatBinary(model.changedBits(name), 16)"
          />
        </span>
      </div>
    </div>

    <!-- The segment drops down into the adder; the offset comes in off the internal bus. -->
    <DiagramWire
      class="ml-[calc(50%+0.625rem)] hidden h-auto min-h-3 w-0.5 flex-1 sm:block"
      :kind="model.adderKind"
      :tick="model.pulse"
    />
    <div class="mt-3 flex items-center sm:mt-0">
      <DiagramWire class="hidden w-5 sm:block" :kind="model.adderKind" :tick="model.pulse" />
      <!--
        The sum is laid out whether or not there is one to show: without an address its numbers
        are dashes, so the unit says what it does and keeps its size. Why it is idle is in its
        tooltip.
      -->
      <div
        class="chip-block min-w-0 flex-1 rounded-lg border px-3 py-2"
        :class="{ 'unit-idle': !adder }"
        :title="adder ? undefined : model.notes.adder"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="unit-title mb-0">Address adder</h3>
          <span class="font-mono text-xs text-muted-foreground" aria-hidden="true">Σ</span>
        </div>
        <div
          class="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 font-mono text-code"
        >
          <span class="truncate font-sans text-xs text-muted-foreground">
            {{ adder ? adder.name : 'segment' }} × 10h
          </span>
          <span class="text-right" :class="{ standby: !adder }">{{
            adder ? formatPhysical(adder.shifted) : '-----'
          }}</span>
          <span class="truncate font-sans text-xs text-muted-foreground">+ offset</span>
          <span class="text-right" :class="{ standby: !adder }">{{
            adder ? formatHex(adder.offset, 16) : '----'
          }}</span>
          <span class="col-span-2 my-0.5 border-t" />
          <span class="truncate font-sans text-xs text-muted-foreground">
            {{ adder?.wrapped ? 'wraps past 1MB to' : '20-bit address' }}
          </span>
          <span class="text-right" :class="adder ? 'font-semibold text-pointer' : 'standby'">{{
            adder ? formatPhysical(adder.physical) : '-----'
          }}</span>
        </div>
        <p v-if="!adder" class="sr-only">{{ model.notes.adder }}</p>
      </div>
    </div>
  </section>
</template>
