<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { CircuitBoard, MemoryStick, Wrench } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { faultRows, faultSummary, lineName } from '@/ui/controlFault';
import type { LinkedTopic } from '@/ui/topics';
import type { ControlLens } from '@/ui/useControlLens';
import ControlFault from './ControlFault.vue';
import DisabledReason from './DisabledReason.vue';

const props = defineProps<{ lens: ControlLens }>();
defineEmits<{ open: [topic: LinkedTopic] }>();

const rows = computed(() =>
  faultRows(props.lens.solution.value, props.lens.healthy.value, props.lens.faults.value)
);
/** The lines that are 1, each with the way into the topic that shows what it switches. */
const on = computed(() =>
  rows.value
    .filter((row) => row.on)
    .map((row) => ({ ...row, link: (row.topic && LINKS[row.topic]) || null }))
);
const off = computed(() => rows.value.filter((row) => !row.on));
const picked = computed(
  () => rows.value.find((row) => row.id === props.lens.pickedLine.value) ?? null
);
const summary = computed(() => faultSummary(rows.value));

const OFF_REASON =
  'That page shows what the CPU ran: put back its word, with every line working, to go there.';

const LINKS: Partial<Record<LinkedTopic, { label: string; icon: typeof CircuitBoard }>> = {
  logic: { label: 'Gates', icon: CircuitBoard },
  storage: { label: 'Stored', icon: MemoryStick }
};

// The switch is drawn after every line: the keyboard goes to it, not through the lines between.
const fault = useTemplateRef<InstanceType<typeof ControlFault>>('fault');
async function pick(line: string): Promise<void> {
  props.lens.pickLine(line);
  await nextTick();
  if (props.lens.pickedLine.value === line) fault.value?.focus();
}

// The button goes with the last fault: the focus it held stays here, not at the top of the page.
const note = useTemplateRef<HTMLElement>('note');
async function repairAll(): Promise<void> {
  props.lens.repairLines();
  await nextTick();
  note.value?.focus({ preventScroll: true });
}
</script>

<!--
  What the decoders decided: the lines that are 1 with what each does, then the rest. A line
  pressed can be broken, and the lines that are not what the decoders would set are summed up.
-->
<template>
  <div class="flex flex-col gap-3">
    <div
      ref="note"
      role="group"
      aria-label="Broken lines"
      tabindex="-1"
      class="outline-none"
      :class="summary && 'well flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3 py-2'"
    >
      <!-- The region is there before its text is, or the first note would not be announced. -->
      <p class="max-w-prose min-w-0 flex-1 basis-64 text-sm text-pretty" aria-live="polite">
        <template v-if="summary">
          <span class="font-semibold">{{ summary.broken }}</span>
          {{ summary.effect }}
        </template>
        <span v-else class="sr-only">Every line works.</span>
      </p>
      <Button
        v-if="summary"
        variant="outline"
        size="sm"
        class="w-full @2xl:ml-auto @2xl:w-auto pointer-coarse:h-11"
        @click="repairAll"
      >
        <Wrench />
        Mend every line
      </Button>
    </div>

    <p v-if="on.length === 0" class="max-w-prose text-sm text-pretty">
      No line is 1: the decoder knows no instruction with this opcode, so nothing in the CPU is told
      to do anything.
    </p>
    <ul v-else class="flex flex-col" aria-label="Control lines that are 1">
      <li
        v-for="row in on"
        :key="row.id"
        class="grid grid-cols-[9.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b py-1.5 last:border-b-0"
      >
        <button
          type="button"
          class="control-line px-2 py-1 text-left text-code font-semibold pointer-coarse:min-h-11"
          :aria-pressed="picked?.id === row.id"
          :aria-label="lineName(row)"
          :data-stuck="row.stuck === null ? undefined : ''"
          @click="pick(row.id)"
        >
          {{ row.label }} = 1<span v-if="row.stuck !== null" class="font-normal"> stuck</span>
        </button>
        <span class="text-sm text-pretty">{{ row.does }}</span>
        <!--
          The other topic shows the CPU's instruction, so the way there is for that word only:
          after a change it stays, off, and says why.
        -->
        <DisabledReason
          v-if="row.topic && row.link"
          :reason="lens.asRun.value ? null : OFF_REASON"
          :label="`${row.link.label}: show what ${row.label} switches`"
        >
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs pointer-coarse:h-11"
            :disabled="!lens.asRun.value"
            :aria-label="`${row.link.label}: show what ${row.label} switches`"
            @click="$emit('open', row.topic)"
          >
            <component :is="row.link.icon" />
            {{ row.link.label }}
          </Button>
        </DisabledReason>
      </li>
    </ul>

    <div v-if="off.length > 0" class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="text-muted-foreground">At 0:</span>
      <ul class="contents" aria-label="Control lines that are 0">
        <li v-for="row in off" :key="row.id">
          <button
            type="button"
            class="control-line px-1.5 py-0.5 text-muted-foreground pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-2.5"
            :aria-pressed="picked?.id === row.id"
            :aria-label="lineName(row)"
            :data-stuck="row.stuck === null ? undefined : ''"
            @click="pick(row.id)"
          >
            {{ row.label }}<template v-if="row.stuck !== null"> = 0 stuck</template>
          </button>
        </li>
      </ul>
    </div>

    <ControlFault ref="fault" :lens="lens" :row="picked" />
  </div>
</template>
