<script setup lang="ts">
import type { GateKind } from '@/core/logic/gates';
import { GATE_HEIGHT, GATE_WIDTH } from '@/ui/logicSlice';

defineProps<{
  kind: GateKind;
  x: number;
  y: number;
  /** What the gate works out, for a screen reader. */
  name: string;
  chosen: boolean;
}>();
defineEmits<{ choose: [] }>();

/** The outline of each gate, in a box GATE_WIDTH wide and GATE_HEIGHT high. */
const SHAPES: Record<GateKind, string> = {
  and: 'M0,2 H22 A18,18 0 0 1 22,38 H0 Z',
  or: 'M0,2 Q12,20 0,38 Q26,38 44,20 Q26,2 0,2 Z',
  nor: 'M0,2 Q10,20 0,38 Q22,38 36,20 Q22,2 0,2 Z',
  xor: 'M6,2 Q18,20 6,38 Q30,38 44,20 Q30,2 6,2 Z',
  not: 'M0,4 L34,20 L0,36 Z',
  mux: 'M0,0 L44,10 L44,30 L0,40 Z'
};
</script>

<!-- One gate in its standard shape. Pressing it shows its truth table. -->
<template>
  <g
    class="logic-gate"
    role="button"
    tabindex="0"
    :transform="`translate(${x} ${y})`"
    :aria-pressed="chosen"
    :aria-label="`${kind.toUpperCase()} gate: ${name}`"
    @click="$emit('choose')"
    @keydown.enter.prevent="$emit('choose')"
    @keydown.space.prevent="$emit('choose')"
  >
    <!-- Room for a finger around the gate: 44px even where the drawing is at its smallest. -->
    <rect x="-8" y="-10" width="60" height="60" fill="transparent" />
    <!-- The inputs reach the curved back of an OR or XOR gate. -->
    <path
      v-if="kind === 'or' || kind === 'nor' || kind === 'xor'"
      class="logic-wire"
      d="M0,12 H10 M0,28 H10"
    />
    <path class="logic-gate-body" :d="SHAPES[kind]" />
    <path v-if="kind === 'xor'" class="logic-wire" d="M0,2 Q12,20 0,38" />
    <!-- The small circle that inverts the output. -->
    <circle
      v-if="kind === 'not' || kind === 'nor'"
      class="logic-gate-body"
      :cx="kind === 'not' ? 39 : 40"
      cy="20"
      r="4"
    />
    <text
      :x="kind === 'xor' ? GATE_WIDTH / 2 + 3 : GATE_WIDTH / 2 - 2"
      :y="GATE_HEIGHT / 2 + 3"
      text-anchor="middle"
    >
      {{ kind.toUpperCase() }}
    </text>
  </g>
</template>
