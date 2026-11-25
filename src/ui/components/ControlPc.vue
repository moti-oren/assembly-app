<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { ArrowDown, ArrowRight, ArrowUp, Rewind } from '@lucide/vue';
import { PC, type PcSolution } from '@/core/logic/programCounter';
import { heldAt } from '@/core/logic/register';
import { Button } from '@/components/ui/button';
import { bitsOf, pcChoiceText, pcClockAction, pcPhaseText } from '@/ui/controlView';
import { hexOf } from '@/ui/logicView';
import type { ControlLens } from '@/ui/useControlLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{
  lens: ControlLens;
  solution: PcSolution;
  /** The CPU's next instruction with a control unit to show, if there is one. */
  next: number | null;
}>();
const emit = defineEmits<{ next: [position: number] }>();

const action = computed(() =>
  pcClockAction(props.lens.phase.value, props.next, props.lens.asRun.value)
);
function press(): void {
  if (action.value.kind === 'clock') props.lens.clock();
  else if (action.value.kind === 'next' && props.next !== null) emit('next', props.next);
}

const WIDTH = 32;

// The addresses of a small program differ in their low bits.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.solution.request.held);

const phase = computed(() => props.lens.phase.value);
const clockHigh = computed(() => phase.value === 'high');
const request = computed(() => props.solution.request);
const holds = computed(() => heldAt(props.solution.register, phase.value));
/** Whether PC holds the address the clock edge put in it. */
const loaded = computed(() => phase.value !== 'before' && props.solution.signals[PC.load] === 1);

const SWITCHES = [
  { signal: PC.branch, label: 'Branch' },
  { signal: PC.taken, label: 'taken' },
  { signal: PC.jump, label: 'Jump' },
  { signal: PC.jumpComputed, label: 'JumpReg' },
  { signal: PC.redirect, label: 'to target' },
  { signal: PC.load, label: 'load' }
];
</script>

<!--
  The program counter at the end of the instruction: the two addresses it could take, the lines
  that choose between them, and the clock edge that puts the chosen one in.
-->
<template>
  <div class="flex flex-col gap-3">
    <div ref="rows" class="logic-rows">
      <LogicBitNumbers :width="WIDTH" />
      <LogicRow label="PC+4" name="PC plus 4" :bits="bitsOf(solution.next.result, WIDTH)" />
      <LogicRow
        label="PC+imm"
        name="PC plus the immediate"
        :bits="bitsOf(solution.target.result, WIDTH)"
      />
      <LogicRow
        v-if="request.jumpComputed"
        label="ALU"
        name="The address from the ALU"
        :bits="bitsOf(request.computed, WIDTH)"
      />
      <LogicRow label="Chosen" name="The address chosen" :bits="bitsOf(solution.chosen, WIDTH)" />
      <LogicRow
        label="PC"
        name="PC"
        :tone="loaded ? 'result' : 'plain'"
        :bits="bitsOf(holds, WIDTH)"
      />
    </div>

    <dl class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
      <div class="flex gap-1.5">
        <dt class="text-muted-foreground">PC + 4</dt>
        <dd>{{ hexOf(solution.next.result, WIDTH) }}</dd>
      </div>
      <div class="flex gap-1.5">
        <dt class="text-muted-foreground">PC + imm</dt>
        <dd>{{ hexOf(solution.target.result, WIDTH) }}</dd>
      </div>
      <div class="flex gap-1.5">
        <dt class="text-muted-foreground">PC</dt>
        <dd :class="{ 'text-changed-foreground': loaded }">{{ hexOf(holds, WIDTH) }}</dd>
      </div>
    </dl>

    <ul
      class="grid grid-cols-3 gap-x-3 gap-y-1.5 @xl:flex @xl:flex-wrap"
      aria-label="The lines that choose the address"
    >
      <li
        v-for="each in SWITCHES"
        :key="each.signal"
        class="flex items-center justify-between gap-1.5 text-xs text-muted-foreground @xl:justify-start"
      >
        {{ each.label }}
        <span
          class="logic-bit [--cell:1.875rem]"
          :data-on="solution.signals[each.signal] ? '' : undefined"
          >{{ solution.signals[each.signal] }}</span
        >
      </li>
    </ul>
    <p class="max-w-prose text-sm text-pretty">{{ pcChoiceText(solution) }}</p>
    <p
      v-if="lens.fromCpu.value?.pcNote"
      class="max-w-prose text-xs text-pretty text-muted-foreground"
    >
      {{ lens.fromCpu.value.pcNote }}
    </p>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variant="outline"
        size="sm"
        class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground pointer-coarse:h-11"
        :aria-disabled="action.kind === 'done' ? 'true' : undefined"
        @click="press"
      >
        <ArrowRight v-if="action.kind !== 'clock'" />
        <ArrowDown v-else-if="clockHigh" />
        <ArrowUp v-else />
        {{ action.label }}
      </Button>
      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
        Clock
        <span
          class="logic-bit [--cell:1.875rem]"
          :data-on="clockHigh ? '' : undefined"
          aria-hidden="true"
          >{{ clockHigh ? 1 : 0 }}</span
        >
        <span class="sr-only">is {{ clockHigh ? 'high, 1' : 'low, 0' }}</span>
      </span>
      <!-- It stays in place, and can keep the focus, when there is nothing to go back to. -->
      <Button
        variant="ghost"
        size="sm"
        class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:h-11"
        :aria-disabled="phase === 'before'"
        @click="lens.rewind()"
      >
        <Rewind />
        Rewind the clock
      </Button>
    </div>
    <p class="max-w-prose text-sm text-pretty" aria-live="polite">
      {{ pcPhaseText(phase, solution.signals[PC.load] === 1) }}
    </p>
  </div>
</template>
