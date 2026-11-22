<script setup lang="ts">
import type { Bit } from '@/core/logic/gates';
import { bitsLeftToRight, startsDigit } from '@/ui/logicLayout';

/** A bit shown beside the row: the carry out on the left, or a bit that fell off the right. */
interface EndBit {
  value: Bit;
  label: string;
}

const props = withDefaults(
  defineProps<{
    label: string;
    /** What the row holds, for a screen reader: `A`, `the sum`. */
    name: string;
    /** The row's bits, bit 0 first. */
    bits: readonly Bit[];
    tone?: 'plain' | 'result' | 'quiet';
    /** `flip`: every bit is a switch. `lowest`: only bit 0 is. `choose`: a bit is picked. */
    mode?: 'flip' | 'lowest' | 'choose' | 'static';
    /** The bit picked, in a row whose bits are picked. */
    chosen?: number | null;
    lead?: EndBit | null;
    tail?: EndBit | null;
    /** Whether the row has room on its right for a tail, so its bits line up with one that has. */
    tailed?: boolean;
  }>(),
  { tone: 'plain', mode: 'static', chosen: null, lead: null, tail: null, tailed: false }
);

const emit = defineEmits<{ flip: [bit: number]; choose: [bit: number] }>();

function isButton(bit: number): boolean {
  return props.mode === 'flip' || props.mode === 'choose' || (props.mode === 'lowest' && bit === 0);
}

function press(bit: number): void {
  if (props.mode === 'choose') emit('choose', bit);
  else emit('flip', bit);
}
</script>

<!-- One row of the circuit: a name, then a bit in every column, the top bit on the left. -->
<template>
  <div class="logic-row">
    <div class="logic-label">{{ label }}</div>
    <div class="logic-cell">
      <span
        v-if="lead"
        class="logic-bit"
        data-tone="quiet"
        :data-on="lead.value ? '' : undefined"
        :style="{ '--bit': bits.length }"
        :title="lead.label"
      >
        {{ lead.value }}<span class="sr-only">, {{ lead.label }}</span>
      </span>
    </div>
    <div
      v-for="bit in bitsLeftToRight(bits.length)"
      :key="bit"
      class="logic-cell"
      :data-digit-start="startsDigit(bits.length, bit) ? '' : undefined"
    >
      <button
        v-if="isButton(bit)"
        type="button"
        class="logic-bit"
        :data-tone="tone"
        :data-on="bits[bit] ? '' : undefined"
        :data-chosen="mode === 'choose' && chosen === bit ? '' : undefined"
        :style="{ '--bit': bit }"
        :aria-pressed="mode === 'choose' ? chosen === bit : bits[bit] === 1"
        :aria-label="`${name}, bit ${bit}: ${bits[bit]}`"
        @click="press(bit)"
      >
        {{ bits[bit] }}
      </button>
      <span
        v-else
        class="logic-bit"
        :data-tone="tone"
        :data-on="bits[bit] ? '' : undefined"
        :style="{ '--bit': bit }"
        role="img"
        :aria-label="`${name}, bit ${bit}: ${bits[bit]}`"
      >
        {{ bits[bit] }}
      </span>
    </div>
    <div v-if="tail || tailed" class="logic-cell">
      <span
        v-if="tail"
        class="logic-bit"
        data-tone="quiet"
        :data-on="tail.value ? '' : undefined"
        :title="tail.label"
      >
        {{ tail.value }}<span class="sr-only">, {{ tail.label }}</span>
      </span>
    </div>
  </div>
</template>
