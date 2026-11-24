<script setup lang="ts">
import { computed } from 'vue';
import { conflictText, effectRows, effectSummary } from '@/ui/controlEffect';
import type { ControlLens } from '@/ui/useControlLens';

const props = defineProps<{ lens: ControlLens }>();

const outcome = computed(() => props.lens.outcome.value);
const rows = computed(() =>
  outcome.value ? effectRows(outcome.value, props.lens.wholeOutcome.value) : []
);
const summary = computed(() => (props.lens.anyBroken.value ? effectSummary(rows.value) : null));
const conflicts = computed(() => outcome.value?.conflicts.map(conflictText) ?? []);
</script>

<!--
  What the lines make the datapath do with the word, against the registers and memory the CPU's
  instruction found; with a line broken, beside what it would do whole.
-->
<template>
  <p v-if="!outcome" class="max-w-prose text-sm text-pretty">
    Run an instruction on the RISC-V CPU to see what its lines make the CPU do: the registers and
    memory it found are what the lines work on.
  </p>
  <div v-else class="flex flex-col gap-3">
    <p v-if="lens.isEdited.value" class="max-w-prose text-sm text-pretty text-muted-foreground">
      This word never ran. This is what it would do in place of the CPU’s instruction, with the same
      registers and memory.
    </p>
    <!-- The region is there before its text is, or the first summary would not be announced. -->
    <p class="max-w-prose text-sm font-semibold text-pretty" aria-live="polite">
      <template v-if="summary">{{ summary }}</template>
    </p>
    <dl class="flex flex-col">
      <div
        v-for="row in rows"
        :key="row.id"
        class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 border-b py-1.5 last:border-b-0 max-sm:grid-cols-1"
      >
        <dt class="text-sm text-muted-foreground">{{ row.label }}</dt>
        <dd class="min-w-0 font-mono text-code break-words">
          <span :class="row.instead !== null && 'font-semibold'">{{ row.text }}</span>
          <span v-if="row.instead !== null" class="block text-muted-foreground">
            <span class="font-sans text-xs">with every line working: </span>{{ row.instead }}
          </span>
        </dd>
      </div>
    </dl>
    <p v-if="outcome.trap" class="max-w-prose text-sm text-pretty">
      <span class="font-semibold">The CPU traps.</span> {{ outcome.trap }}
    </p>
    <ul v-if="conflicts.length" class="flex max-w-prose flex-col gap-1 text-sm text-pretty">
      <li v-for="conflict in conflicts" :key="conflict">{{ conflict }}</li>
    </ul>
  </div>
</template>
