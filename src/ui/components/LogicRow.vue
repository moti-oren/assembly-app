<script setup lang="ts">
import { computed } from 'vue';
import type { Bit } from '@/core/logic/gates';
import { bitsLeftToRight, rowSaid, startsDigit } from '@/ui/logicLayout';

/** A bit shown beside the row: the carry out on the left, or a bit that fell off the right. */
interface EndBit {
  value: Bit;
  label: string;
  /** Whether the bit will change again before the circuit is at rest. */
  pending?: boolean;
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
    /** For every bit, whether it will change again before the circuit is at rest. */
    pending?: readonly boolean[] | null;
    /** Bits drawn plain whatever the row's tone, bit 0 first: those not written, for one. */
    plain?: readonly boolean[] | null;
    /** For every bit, whether a broken gate made it the wrong value. */
    wrong?: readonly boolean[] | null;
    /** The bit picked, in a row whose bits are picked. */
    chosen?: number | null;
    lead?: EndBit | null;
    tail?: EndBit | null;
    /** Whether the row has room on its right for a tail, so its bits line up with one that has. */
    tailed?: boolean;
  }>(),
  {
    tone: 'plain',
    mode: 'static',
    pending: null,
    plain: null,
    wrong: null,
    chosen: null,
    lead: null,
    tail: null,
    tailed: false
  }
);

const emit = defineEmits<{ flip: [bit: number]; choose: [bit: number] }>();

function isButton(bit: number): boolean {
  return props.mode === 'flip' || props.mode === 'choose' || (props.mode === 'lowest' && bit === 0);
}

const toneOf = (bit: number) => (props.plain?.[bit] ? 'plain' : props.tone);

/** What a screen reader hears for one bit of the row. */
function describe(bit: number): string {
  const unsettled = props.pending?.[bit] ? ', not settled yet' : '';
  const mistaken = props.wrong?.[bit] ? ', wrong' : '';
  return `${props.name}, bit ${bit}: ${props.bits[bit]}${unsettled}${mistaken}`;
}

/**
 * A row only read, with nothing on it to tell bit by bit (an end bit, a bit not settled, wrong
 * or plain), is heard as one value.
 */
const heardWhole = computed(
  () =>
    props.mode === 'static' &&
    !props.lead &&
    !props.tail &&
    !props.pending?.some(Boolean) &&
    !props.wrong?.some(Boolean) &&
    !props.plain?.some(Boolean)
);

function press(bit: number): void {
  if (props.mode === 'choose') emit('choose', bit);
  else emit('flip', bit);
}
</script>

<!-- One row of the circuit: a name, then a bit in every column, the top bit on the left. -->
<template>
  <div
    class="logic-row"
    :role="heardWhole ? 'img' : undefined"
    :aria-label="heardWhole ? rowSaid(name, bits) : undefined"
  >
    <div class="logic-label" :aria-hidden="heardWhole || undefined">{{ label }}</div>
    <div class="logic-cell">
      <span
        v-if="lead"
        class="logic-bit"
        data-tone="quiet"
        :data-on="lead.value ? '' : undefined"
        :data-pending="lead.pending ? '' : undefined"
        :style="{ '--bit': bits.length }"
        :title="lead.label"
      >
        {{ lead.value
        }}<span class="sr-only"
          >, {{ lead.label }}{{ lead.pending ? ', not settled yet' : '' }}</span
        >
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
        :data-tone="toneOf(bit)"
        :data-on="bits[bit] ? '' : undefined"
        :data-pending="pending?.[bit] ? '' : undefined"
        :data-wrong="wrong?.[bit] ? '' : undefined"
        :data-chosen="mode === 'choose' && chosen === bit ? '' : undefined"
        :style="{ '--bit': bit }"
        :aria-pressed="mode === 'choose' ? chosen === bit : bits[bit] === 1"
        :aria-label="describe(bit)"
        @click="press(bit)"
      >
        {{ bits[bit] }}
      </button>
      <span
        v-else
        class="logic-bit"
        :data-tone="toneOf(bit)"
        :data-on="bits[bit] ? '' : undefined"
        :data-pending="pending?.[bit] ? '' : undefined"
        :data-wrong="wrong?.[bit] ? '' : undefined"
        :style="{ '--bit': bit }"
        :role="heardWhole ? undefined : 'img'"
        :aria-label="heardWhole ? undefined : describe(bit)"
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
