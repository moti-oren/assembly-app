<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ExtensionRequest, ExtensionSolution } from '@/core/representation/extension';
import { Button } from '@/components/ui/button';
import { bitsLeftToRight, startsDigit } from '@/ui/logicLayout';
import { bitsOf } from '@/ui/numbersView';
import type { NumberLens } from '@/ui/useNumberLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';

const props = defineProps<{
  lens: NumberLens;
  request: ExtensionRequest;
  solution: ExtensionSolution;
}>();

useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.request.to);

const FILLS = [
  { signed: true, label: 'Copy the top bit' },
  { signed: false, label: 'Fill with zeros' }
] as const;
const NARROW = [8, 16] as const;

const narrow = computed(() => bitsOf(props.solution.value, props.request.from));
const wide = computed(() => bitsOf(props.solution.result, props.request.to));
const text = (value: number): string => value.toLocaleString('en-US').replace('-', '−');

/** The two scales, before and after: the one the extension keeps is the same on both sides. */
const scales = computed(() => {
  const { before, after } = props.solution;
  return (['unsigned', 'signed'] as const).map((scale) => ({
    scale,
    before: text(before[scale]),
    after: text(after[scale]),
    kept: before[scale] === after[scale]
  }));
});
</script>

<!-- A narrow value above the wide one it becomes: the new places all take one bit. -->
<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="toggle-group" role="group" aria-label="How the new bits are filled">
      <Button
        v-for="fill in FILLS"
        :key="fill.label"
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-10"
        :aria-pressed="request.signed === fill.signed"
        @click="lens.change({ ...request, signed: fill.signed })"
      >
        {{ fill.label }}
      </Button>
    </div>
    <div class="toggle-group" role="group" aria-label="Bits of the value">
      <Button
        v-for="bits in NARROW"
        :key="bits"
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-10"
        :disabled="bits >= request.to"
        :aria-pressed="request.from === bits"
        @click="lens.change({ ...request, from: bits, value: request.value % 2 ** bits })"
      >
        From {{ bits }} bits
      </Button>
    </div>
  </div>

  <div ref="rows" class="logic-rows mt-3">
    <LogicBitNumbers :width="request.to" />
    <div class="logic-row">
      <div class="logic-label">Value</div>
      <div class="logic-cell" />
      <div
        v-for="bit in bitsLeftToRight(request.to)"
        :key="bit"
        class="logic-cell"
        :data-digit-start="startsDigit(request.to, bit) ? '' : undefined"
      >
        <button
          v-if="bit < request.from"
          type="button"
          class="logic-bit"
          :data-on="narrow[bit] ? '' : undefined"
          :data-chosen="bit === request.from - 1 ? '' : undefined"
          :aria-pressed="narrow[bit] === 1"
          :aria-label="`The value, bit ${bit}${bit === request.from - 1 ? ', its top bit' : ''}: ${narrow[bit]}`"
          @click="lens.flipBit('a', bit)"
        >
          {{ narrow[bit] }}
        </button>
      </div>
    </div>
    <div class="logic-row">
      <div class="logic-label">Extended</div>
      <div class="logic-cell" />
      <div
        v-for="bit in bitsLeftToRight(request.to)"
        :key="bit"
        class="logic-cell"
        :data-digit-start="startsDigit(request.to, bit) ? '' : undefined"
      >
        <span
          class="logic-bit"
          :data-tone="lens.written.value ? 'result' : undefined"
          :data-on="wide[bit] ? '' : undefined"
          :data-filled="bit >= request.from ? '' : undefined"
          role="img"
          :aria-label="`The extended value, bit ${bit}${bit >= request.from ? ', filled in' : ''}: ${wide[bit]}`"
        >
          {{ wide[bit] }}
        </span>
      </div>
    </div>
  </div>

  <p class="mt-3 text-sm text-pretty">
    The {{ request.to - request.from }} new bits are all
    <span class="font-mono font-semibold">{{ solution.fill }}</span>{{
      request.signed
        ? `, a copy of bit ${request.from - 1}, the value’s top bit.`
        : ', whatever the value’s top bit is.'
    }}
  </p>
  <ul class="mt-2 divide-y text-sm">
    <li
      v-for="each in scales"
      :key="each.scale"
      class="flex flex-wrap items-baseline gap-x-3 px-1.5 py-2"
    >
      <span class="w-20 shrink-0 font-semibold capitalize">{{ each.scale }}</span>
      <span class="font-mono tabular-nums">{{ each.before }} → {{ each.after }}</span>
      <span :class="each.kept ? 'text-muted-foreground' : 'font-semibold'">
        {{ each.kept ? 'the same number' : 'a different number' }}
      </span>
    </li>
  </ul>
</template>
