<script setup lang="ts">
import { computed } from 'vue';
import { Timer } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import type { LogicLens } from '@/ui/useLogicLens';
import DisabledReason from './DisabledReason.vue';

const props = defineProps<{
  lens: LogicLens;
  /** Only its icon: on a phone's bar, which has no room for its name. */
  compact?: boolean;
}>();

const time = computed(() => props.lens.time);
</script>

<!-- The switch that slows the adder down, so its gate delays can be stepped through. -->
<template>
  <DisabledReason
    :reason="
      time.available.value
        ? null
        : 'Only the adder takes its time here: pick Add or Subtract to slow it down'
    "
    label="Slow down time"
    hint="Shows the adder’s wires one gate delay at a time"
  >
    <Button
      :variant="time.on.value ? 'default' : 'outline'"
      size="sm"
      class="pointer-coarse:h-11 pointer-coarse:min-w-11"
      aria-label="Slow down time"
      :aria-pressed="time.on.value"
      :disabled="!time.available.value"
      @click="time.toggle()"
    >
      <Timer />
      <!-- Slowed down, the steps beside it need the room on anything narrower than a wide desktop. -->
      <span :class="{ 'sr-only': compact, 'max-xl:sr-only': time.on.value }">Slow down time</span>
    </Button>
  </DisabledReason>
</template>
