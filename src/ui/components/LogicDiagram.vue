<script setup lang="ts">
import { computed } from 'vue';
import type { Signals } from '@/core/logic/gates';
import { gateTable, polyline, type SliceDiagram } from '@/ui/logicSlice';
import LogicGate from './LogicGate.vue';

const props = defineProps<{
  diagram: SliceDiagram;
  /** The value on every wire of the drawing. */
  signals: Signals;
  /** The gate whose truth table is on show, by its place in the drawing. */
  chosen: number;
  /** What the drawing is of, for a screen reader. */
  label: string;
  /** Whether the outputs are something a CPU wrote: colour marks a write, and only a real one. */
  written: boolean;
}>();
defineEmits<{ choose: [gate: number] }>();

const gate = computed(() => props.diagram.gates[props.chosen] ?? null);
const table = computed(() => gate.value && gateTable(gate.value, props.signals));
</script>

<!-- A circuit drawn gate by gate, with the truth table of the gate picked. -->
<template>
  <div class="flex flex-col gap-4">
    <div class="well overflow-x-auto rounded-lg p-3">
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
    </div>

    <div v-if="gate && table" class="flex flex-wrap items-start gap-x-8 gap-y-3">
      <div>
        <h4 class="text-xs font-semibold">
          {{ gate.kind.toUpperCase() }}
          <span class="font-normal text-muted-foreground">: {{ gate.name }}</span>
        </h4>
        <table class="mt-2 font-mono text-code tabular-nums">
          <thead>
            <tr class="text-xs text-muted-foreground">
              <th
                v-for="name in gate.inputNames"
                :key="name"
                scope="col"
                class="px-2 py-1 font-normal"
              >
                {{ name }}
              </th>
              <th scope="col" class="border-l px-2 py-1 font-normal">out</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in table.rows"
              :key="index"
              :class="index === table.active ? 'bg-muted font-semibold' : 'text-muted-foreground'"
              :aria-current="index === table.active ? 'true' : undefined"
            >
              <td v-for="(input, at) in row.inputs" :key="at" class="px-2 py-0.5 text-center">
                {{ input }}
              </td>
              <td class="border-l px-2 py-0.5 text-center">{{ row.output }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4 class="text-xs font-semibold">As Boolean algebra</h4>
        <ul class="mt-2 space-y-1 font-mono text-code">
          <li v-for="expression in diagram.expressions" :key="expression">{{ expression }}</li>
        </ul>
        <p class="mt-2 text-xs text-muted-foreground">Press a gate to see its truth table.</p>
      </div>
    </div>
  </div>
</template>
