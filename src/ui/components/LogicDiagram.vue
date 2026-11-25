<script setup lang="ts">
import { computed } from 'vue';
import type { Faults } from '@/core/logic/fault';
import type { Signals } from '@/core/logic/gates';
import { gateTable, type DiagramGate, type SliceDiagram } from '@/ui/logicSlice';
import LogicDrawing from './LogicDrawing.vue';

const props = withDefaults(
  defineProps<{
    diagram: SliceDiagram;
    /** The value on every wire of the drawing. */
    signals: Signals;
    /** The gate whose truth table is on show, by its place in the drawing. */
    chosen: number;
    /** What the drawing is of, for a screen reader. */
    label: string;
    /** Whether the outputs are something a CPU wrote: colour marks a write, and only a real one. */
    written: boolean;
    /** The gates that are broken, by the signal each drives. */
    stuck?: Faults;
    /** A circuit that never came to rest: its own wires are drawn with no value. */
    undecided?: boolean;
  }>(),
  { stuck: () => ({}), undecided: false }
);
defineEmits<{ choose: [gate: number] }>();
defineSlots<{
  /** What else there is to say or do about the gate picked, under its truth table. */
  gate?: (props: { gate: DiagramGate }) => unknown;
  /** The same, across the whole width under the table. */
  under?: (props: { gate: DiagramGate }) => unknown;
}>();

const gate = computed(() => props.diagram.gates[props.chosen] ?? null);
const table = computed(() => gate.value && gateTable(gate.value, props.signals));
</script>

<!-- A circuit drawn gate by gate, with the truth table of the gate picked. -->
<template>
  <div class="flex flex-col gap-4">
    <div class="well scroll-fade-x overflow-x-auto rounded-lg p-3">
      <LogicDrawing
        :diagram="diagram"
        :signals="signals"
        :chosen="chosen"
        :label="label"
        :written="written"
        :stuck="stuck"
        :undecided="undecided"
        @choose="$emit('choose', $event)"
      />
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
        <div v-if="$slots.gate" class="mt-3"><slot name="gate" :gate="gate" /></div>
      </div>
      <div>
        <h4 class="text-xs font-semibold">As Boolean algebra</h4>
        <ul class="mt-2 space-y-1 font-mono text-code">
          <li v-for="expression in diagram.expressions" :key="expression">{{ expression }}</li>
        </ul>
        <p class="mt-2 text-xs text-muted-foreground">Press a gate to see its truth table.</p>
      </div>
    </div>
    <slot v-if="gate" name="under" :gate="gate" />
  </div>
</template>
