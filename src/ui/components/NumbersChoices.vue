<script setup lang="ts">
import { computed } from 'vue';
import { numbersChoices, withChoice } from '@/ui/numbersChoices';
import type { NumberLens } from '@/ui/useNumberLens';
import ChoiceGroup from './ChoiceGroup.vue';

const props = defineProps<{ lens: NumberLens }>();

const choices = computed(() => numbersChoices(props.lens.request.value));
</script>

<!-- What a lens sets once (which way, what fills, add or take off): in the sidebar, as a width is. -->
<template>
  <div v-for="choice in choices" :key="choice.id">
    <ChoiceGroup
      :label="choice.label"
      titled
      :columns="choice.choices.length"
      :choices="choice.choices"
      :chosen="choice.chosen"
      :disabled="choice.disabled"
      @pick="lens.change(withChoice(lens.request.value, choice.id, $event))"
    />
    <p v-if="choice.reason" class="mt-1 text-xs text-muted-foreground">{{ choice.reason }}</p>
  </div>
</template>
