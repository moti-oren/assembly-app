<script setup lang="ts">
import { computed } from 'vue';
import { CircuitBoard, MemoryStick } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { controlLines } from '@/ui/controlView';
import type { LinkedTopic } from '@/ui/topics';
import type { ControlLens } from '@/ui/useControlLens';

const props = defineProps<{ lens: ControlLens }>();
defineEmits<{ open: [topic: LinkedTopic] }>();

const rows = computed(() => controlLines(props.lens.solution.value));
/** The lines that are 1, each with the way into the topic that shows what it switches. */
const on = computed(() =>
  rows.value
    .filter((row) => row.on)
    .map((row) => ({ ...row, link: (row.topic && LINKS[row.topic]) || null }))
);
const off = computed(() => rows.value.filter((row) => !row.on));

const LINKS: Partial<Record<LinkedTopic, { label: string; icon: typeof CircuitBoard }>> = {
  logic: { label: 'Gates', icon: CircuitBoard },
  storage: { label: 'Stored', icon: MemoryStick }
};
</script>

<!-- What the decoders decided: the lines that are 1 with what each does, then the rest. -->
<template>
  <div class="flex flex-col gap-3">
    <p v-if="on.length === 0" class="max-w-prose text-sm text-pretty">
      No line is 1: the decoder knows no instruction with this opcode, so nothing in the CPU is told
      to do anything.
    </p>
    <ul v-else class="flex flex-col" aria-label="Control lines that are 1">
      <li
        v-for="row in on"
        :key="row.id"
        class="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b py-1.5 last:border-b-0"
      >
        <span class="font-mono text-code font-semibold">{{ row.label }} = 1</span>
        <span class="text-sm text-pretty">{{ row.does }}</span>
        <!-- The other topic shows the CPU's instruction, so the way there is for that word only. -->
        <Button
          v-if="row.topic && row.link && lens.asRun.value"
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 px-2 text-xs pointer-coarse:h-11"
          :aria-label="`${row.link.label}: show what ${row.label} switches`"
          @click="$emit('open', row.topic)"
        >
          <component :is="row.link.icon" />
          {{ row.link.label }}
        </Button>
      </li>
    </ul>
    <p v-if="off.length > 0" class="text-xs text-pretty text-muted-foreground">
      At 0:
      <span class="font-mono">{{ off.map((row) => row.label).join(', ') }}</span>
    </p>
  </div>
</template>
