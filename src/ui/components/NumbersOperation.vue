<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { WIDTHS } from '@/ui/logicView';
import { LENSES, widthAllowed } from '@/ui/numbersView';
import type { NumberLens } from '@/ui/useNumberLens';
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
    <div>
      <h3 class="mb-(--sublabel-gap) text-xs font-semibold">What to show</h3>
      <div class="toggle-group flex-wrap" role="group" aria-label="What to show">
        <Button
          v-for="choice in LENSES"
          :key="choice.id"
          variant="ghost"
          size="sm"
          class="h-7 px-2.5 text-xs pointer-coarse:h-11"
          :aria-pressed="request.kind === choice.id"
          @click="lens.pick(choice.id)"
        >
          {{ choice.label }}
        </Button>
      </div>
    </div>
    <WidthPicker :width="lens.width.value" :disallowed="disallowed" @set="lens.setWidth" />
    <NumbersExtra
      v-if="withExtra && (request.kind === 'add' || request.kind === 'subtract')"
      :lens="lens"
    />
  </div>
</template>
