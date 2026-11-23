<script setup lang="ts">
import { computed } from 'vue';
import type { BcdRequest, BcdSolution } from '@/core/representation/bcd';
import { Button } from '@/components/ui/button';
import { formatBits } from '@/core/shared/numbers';
import { bitsOf } from '@/ui/numbersView';
import type { NumberLens } from '@/ui/useNumberLens';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{
  lens: NumberLens;
  request: BcdRequest;
  solution: BcdSolution;
}>();

const OPERATIONS = [
  { id: 'add', label: 'Add' },
  { id: 'subtract', label: 'Subtract' }
] as const;

const adding = computed(() => props.request.operation === 'add');
const sign = computed(() => (adding.value ? '+' : '−'));
/** The digits as they are written: tens on the left. */
const digits = computed(() => [...props.solution.digits].reverse());
const nibble = (value: number): string => formatBits(value & 0x0f, 4);
const text = (value: number): string => String(value).replace('-', '−');
</script>

<!-- A byte as two decimal digits: each half summed in binary, then put right where it must be. -->
<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="toggle-group" role="group" aria-label="Operation">
      <Button
        v-for="choice in OPERATIONS"
        :key="choice.id"
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-11"
        :aria-pressed="request.operation === choice.id"
        @click="lens.change({ ...request, operation: choice.id })"
      >
        {{ choice.label }}
      </Button>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        class="size-4 pointer-coarse:size-5"
        :checked="request.extra === 1"
        @change="lens.flipExtra()"
      />
      {{ adding ? 'A carry coming in' : 'A borrow coming in' }}
    </label>
  </div>

  <div class="logic-rows mt-3">
    <LogicBitNumbers :width="8" />
    <LogicRow
      label="A"
      name="A"
      mode="flip"
      :bits="bitsOf(request.a, 8)"
      @flip="lens.flipBit('a', $event)"
    />
    <LogicRow
      label="B"
      name="B"
      mode="flip"
      :bits="bitsOf(request.b, 8)"
      @flip="lens.flipBit('b', $event)"
    />
    <LogicRow
      label="Result"
      name="The result"
      :tone="lens.written.value ? 'result' : 'plain'"
      :bits="bitsOf(solution.result, 8)"
    />
  </div>

  <div class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
    <section
      v-for="digit in digits"
      :key="digit.place"
      class="rounded-md border px-3 py-2.5"
      :aria-label="`The ${digit.place} digit`"
    >
      <h3 class="text-xs font-semibold text-muted-foreground capitalize">{{ digit.place }}</h3>
      <p class="mt-1 font-mono text-sm tabular-nums">
        {{ digit.a }} {{ sign }} {{ digit.b }}
        <template v-if="digit.extra"> {{ sign }} 1</template>
        = <span class="font-semibold">{{ text(digit.raw) }}</span>
        <span class="text-muted-foreground"> ({{ nibble(digit.raw) }})</span>
      </p>
      <p v-if="digit.corrected" class="mt-1 text-sm text-pretty">
        <span class="font-semibold">Not a digit.</span>
        {{ adding ? 'Add 6' : 'Take 6 off' }}:
        <span class="font-mono">{{ nibble(digit.digit) }}</span> is
        <span class="font-mono font-semibold">{{ digit.digit }}</span>, and 1 is
        {{ adding ? 'carried to' : 'borrowed from' }}
        {{ digit.place === 'ones' ? 'the tens' : 'beyond the byte' }}.
      </p>
      <p v-else class="mt-1 text-sm text-muted-foreground">
        A digit as it stands: <span class="font-mono">{{ digit.digit }}</span>.
      </p>
    </section>
  </div>

  <p v-if="solution.decimal" class="mt-3 font-mono text-sm tabular-nums" aria-live="polite">
    {{ solution.decimal.a }} {{ sign }} {{ solution.decimal.b }}
    <template v-if="request.extra"> {{ sign }} 1</template>
    = {{ text(solution.decimal.exact) }}
    <span class="font-sans text-muted-foreground">
      {{
        solution.out
          ? `: outside 0 to 99, so the digits read ${solution.decimal.shown}`
          : ': fits in 0 to 99'
      }}
    </span>
  </p>
  <p v-else class="mt-3 text-sm text-pretty">
    One of the bytes has a half past 9, so it is not a decimal number. The CPU still works digit by
    digit, and the answer means nothing.
  </p>
</template>
