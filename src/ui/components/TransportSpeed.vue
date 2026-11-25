<script setup lang="ts">
import { Gauge } from '@lucide/vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { SPEED_LABELS, isRunSpeed, type RunSpeed } from '@/ui/runSpeeds';

defineProps<{
  speed: RunSpeed;
  /** Whether the speed is always named, or only where the bar has room for it. */
  named?: boolean;
}>();

const emit = defineEmits<{ 'update:speed': [speed: RunSpeed] }>();

/** The select hands back whatever value its item had; only a known speed gets through. */
function setSpeed(value: unknown): void {
  if (isRunSpeed(value)) emit('update:speed', value);
}
</script>

<!-- How fast Run steps through the program. -->
<template>
  <Select :model-value="speed" @update:model-value="setSpeed">
    <SelectTrigger
      size="sm"
      class="pointer-coarse:data-[size=sm]:h-11"
      :class="named ? 'w-full' : 'lg:min-w-24'"
      :aria-label="`Run speed: ${SPEED_LABELS[speed]}`"
    >
      <!--
        The value alone ("Fast") does not say what it is the value of, so an icon says it. The word
        stays from a laptop's width up: an icon alone hides which speed is chosen.
      -->
      <SelectValue>
        <Gauge class="text-muted-foreground" aria-hidden="true" />
        <span :class="{ 'hidden lg:inline': !named }">{{ SPEED_LABELS[speed] }}</span>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="(label, value) in SPEED_LABELS" :key="value" :value="value">
        {{ label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
