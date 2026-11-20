<script setup lang="ts">
import { formatBinary, formatHex, toSigned } from '@/core/shared/numbers';
import {
  REGISTER_DESCRIPTIONS,
  SPLIT_REGISTERS,
  half,
  type WordRegister
} from '@/core/x86/registers';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import { usePreferences } from '@/ui/usePreferences';
import ChangeMark from './ChangeMark.vue';
import DiagramAlu from './DiagramAlu.vue';
import DiagramFlags from './DiagramFlags.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';
import TapTooltip from './TapTooltip.vue';

defineProps<{
  model: CpuDiagramModel;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
}>();

const { registerBits } = usePreferences();

/** The execution unit holds the data, pointer and index registers, the ALU and the flags. */
const EU_REGISTERS: readonly WordRegister[] = ['ax', 'bx', 'cx', 'dx', 'sp', 'bp', 'si', 'di'];
/** The pointer and index registers start a group of their own. */
const GROUP_START: WordRegister = 'sp';
</script>

<template>
  <section class="min-w-0" aria-label="Execution unit">
    <h3 class="unit-title">Execution unit <span>EU</span></h3>
    <div class="flex flex-col font-mono text-code">
      <!--
        The number system of each column, as in the register table. On a phone the wires are not
        drawn, so a register the instruction used is tinted instead.
      -->
      <div
        class="mb-1 flex h-5 items-center gap-2.5 border-b font-sans text-xs text-muted-foreground"
      >
        <span class="w-6" />
        <span class="w-14">Hex</span>
        <span class="flex w-11 justify-end whitespace-nowrap">Decimal</span>
        <span v-if="registerBits" class="hidden @min-[36rem]:inline">Binary</span>
      </div>
      <div
        v-for="name in EU_REGISTERS"
        :key="name"
        class="flex h-5 items-center gap-2.5 rounded-sm"
        :class="{
          'mt-1.5': name === GROUP_START,
          'max-sm:bg-pointer/15': model.use(name) === 'read',
          'max-sm:bg-written/20': model.use(name) === 'write'
        }"
      >
        <TapTooltip v-slot="{ toggle }">
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="w-6 cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
              @click="toggle"
              >{{ name.toUpperCase() }}</span
            >
          </TooltipTrigger>
          <TooltipContent side="right">{{ REGISTER_DESCRIPTIONS[name] }}</TooltipContent>
        </TapTooltip>

        <span class="w-14">
          <span
            v-if="SPLIT_REGISTERS.includes(name)"
            class="inline-flex gap-1"
            :data-loc="`reg:${name}`"
          >
            <ChangeMark
              :on="(model.changedBits(name) & 0xff00) !== 0"
              :written="model.wrote(half(name, 'h'))"
              :tick="tick"
              :title="`${name[0].toUpperCase()}H`"
              :data-loc="`reg:${name[0]}h`"
            >
              <RollingDigits :text="formatHex(model.value(name) >> 8, 8)" />
            </ChangeMark>
            <ChangeMark
              :on="(model.changedBits(name) & 0x00ff) !== 0"
              :written="model.wrote(half(name, 'l'))"
              :tick="tick"
              :title="`${name[0].toUpperCase()}L`"
              :data-loc="`reg:${name[0]}l`"
            >
              <RollingDigits :text="formatHex(model.value(name), 8)" />
            </ChangeMark>
          </span>
          <ChangeMark
            v-else
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

        <span v-if="registerBits" class="hidden text-2xs @min-[36rem]:inline">
          <RollingDigits
            effect="flip"
            dim-zeros
            :text="formatBinary(model.value(name), 16)"
            :marks="formatBinary(model.changedBits(name), 16)"
          />
        </span>

        <DiagramWire
          class="hidden min-w-5 flex-1 sm:block"
          :kind="model.use(name)"
          :tick="model.pulse"
        />
      </div>
    </div>

    <DiagramAlu :model="model" />

    <DiagramFlags :model="model" :tick="tick" />
  </section>
</template>
