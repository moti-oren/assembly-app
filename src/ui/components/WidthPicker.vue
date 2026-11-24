<script setup lang="ts">
import type { Width } from '@/core/logic/alu';
import { WIDTHS } from '@/ui/logicView';
import ChoiceGroup from './ChoiceGroup.vue';

defineProps<{
  width: Width;
  /** The widths that cannot be picked for what is on show; none when left out. */
  disallowed?: readonly Width[];
}>();
defineEmits<{ set: [width: Width] }>();

const CHOICES = WIDTHS.map((each) => ({ id: each, label: String(each) }));
</script>

<!-- How many bits wide what a topic shows is: 8, 16 or 32. -->
<template>
  <ChoiceGroup
    label="Width in bits"
    titled
    :choices="CHOICES"
    :chosen="width"
    :disabled="disallowed"
    @pick="$emit('set', $event)"
  />
</template>
