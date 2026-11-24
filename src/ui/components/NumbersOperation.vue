<script setup lang="ts">
import { computed } from 'vue';
import { WIDTHS } from '@/ui/logicView';
import { LENSES, widthAllowed } from '@/ui/numbersView';
import type { NumberLens } from '@/ui/useNumberLens';
import ChoiceGroup from './ChoiceGroup.vue';
import NumbersExtra from './NumbersExtra.vue';
import WidthPicker from './WidthPicker.vue';

const props = defineProps<{
  lens: NumberLens;
  /** With the one more a sum can take: left out where it stays under the sum's rows. */
  withExtra?: boolean;
}>();

const request = computed(() => props.lens.request.value);
const disallowed = computed(() => WIDTHS.filter((each) => !widthAllowed(request.value, each)));
</script>

<!-- What the numbers on show are: the operation, how many bits wide, and one more coming in. -->
<template>
  <div class="flex flex-col gap-4">
    <ChoiceGroup
      label="What to show"
      titled
      :choices="LENSES"
      :chosen="request.kind"
      @pick="lens.pick"
    />
    <WidthPicker :width="lens.width.value" :disallowed="disallowed" @set="lens.setWidth" />
    <NumbersExtra
      v-if="withExtra && (request.kind === 'add' || request.kind === 'subtract')"
      :lens="lens"
    />
  </div>
</template>
