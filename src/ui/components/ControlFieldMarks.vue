<script setup lang="ts">
import { computed } from 'vue';
import type { WordField } from '@/core/controlLink';
import { fieldMarks } from '@/ui/controlView';
import { startsDigit } from '@/ui/logicLayout';

const props = defineProps<{ fields: readonly WordField[]; width: number }>();

const marks = computed(() => fieldMarks(props.fields, props.width));
</script>

<!-- The fields of the word as brackets over its bits: where opcode, rd, funct3… begin and end. -->
<template>
  <div class="logic-row text-2xs" data-compact aria-hidden="true">
    <div class="logic-label font-normal! text-tertiary-foreground">field</div>
    <div class="logic-cell" />
    <div
      v-for="mark in marks"
      :key="mark.bit"
      class="logic-cell control-field-mark font-mono"
      :data-digit-start="startsDigit(width, mark.bit) ? '' : undefined"
      :data-start="mark.start ? '' : undefined"
      :data-end="mark.end ? '' : undefined"
      :data-decoded="mark.decoded ? '' : undefined"
    >
      <span
        v-if="mark.label"
        class="control-field-name"
        :style="{ maxWidth: `calc(var(--cell) * ${mark.span} - 0.375rem)` }"
        >{{ mark.label }}</span
      >
    </div>
  </div>
</template>
