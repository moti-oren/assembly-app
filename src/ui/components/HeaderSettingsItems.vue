<script setup lang="ts">
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { usePreferences } from '@/ui/usePreferences';

const { isDark, soundOn, reduceMotion, systemReducesMotion, toggleTheme } = usePreferences();
</script>

<!-- Settings that are changed once in a while, as the items of a menu. -->
<template>
  <DropdownMenuCheckboxItem v-model="soundOn" class="pointer-coarse:py-2.5">
    Sound
  </DropdownMenuCheckboxItem>
  <DropdownMenuCheckboxItem
    class="pointer-coarse:py-2.5"
    :model-value="isDark"
    @update:model-value="toggleTheme"
  >
    Dark theme
  </DropdownMenuCheckboxItem>
  <!-- While the system asks for less motion, the app's own setting cannot bring it back. -->
  <DropdownMenuCheckboxItem
    class="pointer-coarse:py-2.5"
    :model-value="reduceMotion || systemReducesMotion"
    :disabled="systemReducesMotion"
    @update:model-value="reduceMotion = !reduceMotion"
  >
    Reduce animations
  </DropdownMenuCheckboxItem>
</template>
