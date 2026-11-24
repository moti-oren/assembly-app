<script setup lang="ts">
import { Button } from '@/components/ui/button';
import type { LogicLens } from '@/ui/useLogicLens';

defineProps<{ lens: LogicLens }>();
</script>

<!-- Whether the gate picked is also drawn as the NAND gates it could be built from. -->
<template>
  <Button
    :variant="lens.nandShown.value ? 'default' : 'outline'"
    size="sm"
    class="w-max pointer-coarse:h-11"
    :aria-pressed="lens.nandShown.value"
    @click="lens.toggleNand()"
  >
    As NAND gates
  </Button>
</template>
