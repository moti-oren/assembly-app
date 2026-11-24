<script setup lang="ts">
import type { Faults } from '@/core/logic/fault';
import type { Signals } from '@/core/logic/gates';
import { polyline, type SliceDiagram } from '@/ui/logicSlice';
import LogicGate from './LogicGate.vue';

withDefaults(
  defineProps<{
    diagram: SliceDiagram;
    /** The value on every wire of the drawing. */
    signals: Signals;
    /** What the drawing is of, for a screen reader. */
    label: string;
    /** The gate picked, by its place in the drawing. */
    chosen?: number | null;
    /** Whether the outputs are something a CPU wrote: colour marks a write, and only a real one. */
    written?: boolean;
    /** The gates that are broken, by the signal each drives. */
    stuck?: Faults;
    /** A drawing whose gates are only looked at, not picked. */
    still?: boolean;
  }>(),
  { chosen: null, written: false, stuck: () => ({}), still: false }
);
defineEmits<{ choose: [gate: number] }>();
</script>

<!-- Gates and the wires between them, ink where a 1 runs. -->
<template>
  <svg
    class="logic-diagram"
    :viewBox="`0 0 ${diagram.width} ${diagram.height}`"
    :style="{ minWidth: `${diagram.width * 0.75}px`, maxWidth: `${diagram.width * 1.15}px` }"
    role="group"
    :aria-label="`${label}: ${diagram.gates.length} gates`"
  >
    <polyline
      v-for="(wire, index) in diagram.wires"
      :key="index"
      class="logic-wire"
      :points="polyline(wire.points)"
      :data-on="signals[wire.signal] ? '' : undefined"
    />
    <circle
      v-for="dot in diagram.dots"
      :key="`${dot.x},${dot.y}`"
      class="logic-dot"
      :cx="dot.x"
      :cy="dot.y"
      r="3"
      :data-on="signals[dot.signal] ? '' : undefined"
    />
    <LogicGate
      v-for="(each, index) in diagram.gates"
      :key="each.id"
      :kind="each.kind"
      :x="each.x"
      :y="each.y"
      :name="each.name"
      :chosen="index === chosen"
      :stuck="stuck[each.id] ?? null"
      :still="still"
      @choose="$emit('choose', index)"
    />
    <text
      v-for="terminal in diagram.terminals"
      :key="terminal.signal + terminal.side"
      class="logic-terminal"
      :x="terminal.side === 'in' ? terminal.x - 8 : terminal.x + 8"
      :y="terminal.y + 4"
      :text-anchor="terminal.side === 'in' ? 'end' : 'start'"
    >
      {{ terminal.label }}
      <tspan
        class="logic-value"
        dx="3"
        :data-tone="terminal.side === 'out' && written ? 'result' : undefined"
      >
        {{ signals[terminal.signal] }}
      </tspan>
    </text>
  </svg>
</template>
