<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { Bit } from '@/core/logic/gates';
import { Button } from '@/components/ui/button';
import { faultNote, type FaultRow } from '@/ui/controlFault';
import type { ControlLens } from '@/ui/useControlLens';

const props = defineProps<{
  lens: ControlLens;
  /** The line picked in the list, when one is. */
  row: FaultRow | null;
}>();

const note = computed(() => (props.row ? faultNote(props.row) : null));
const VALUES: readonly Bit[] = [0, 1];

const group = useTemplateRef<HTMLElement>('group');
defineExpose({
  /** Puts the keyboard on the switch's setting, so it is the next thing after picking a line. */
  focus: (): void =>
    group.value?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
});
</script>

<!-- Breaks the line picked: it stays at 0 or at 1, whatever the decoders say. -->
<template>
  <div :class="row && 'well flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3 py-2'">
    <div
      v-if="row"
      ref="group"
      class="toggle-group w-max"
      role="group"
      :aria-label="`Break this line: ${row.label}`"
    >
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-11"
        :aria-pressed="row.stuck === null"
        @click="lens.repairLine(row.id)"
      >
        Works
      </Button>
      <Button
        v-for="value in VALUES"
        :key="value"
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-11"
        :aria-pressed="row.stuck === value"
        @click="lens.stickLine(row.id, value)"
      >
        Stuck at {{ value }}
      </Button>
    </div>
    <!-- The region is there before its text is, or the first note would not be announced. -->
    <p class="max-w-prose min-w-0 flex-1 basis-64 text-sm text-pretty" aria-live="polite">
      <span v-if="note">{{ note }}</span>
    </p>
  </div>
</template>
