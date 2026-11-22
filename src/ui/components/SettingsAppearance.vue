<script setup lang="ts">
import { usePreferences, type Theme } from '@/ui/usePreferences';
import SettingsChoice from './SettingsChoice.vue';
import SettingsRow from './SettingsRow.vue';
import SettingsSwitch from './SettingsSwitch.vue';

const { theme, setTheme, reduceMotion, systemReducesMotion } = usePreferences();

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' }
];
</script>

<template>
  <SettingsRow
    v-slot="{ named }"
    label="Theme"
    description="System follows the light or dark mode of your device."
  >
    <SettingsChoice
      :model-value="theme"
      :options="THEMES"
      v-bind="named"
      @update:model-value="setTheme"
    />
  </SettingsRow>
  <!-- While the system asks for less motion, the app's own setting cannot bring it back. -->
  <SettingsRow
    v-slot="{ named }"
    label="Reduce animations"
    :description="
      systemReducesMotion
        ? 'Set by your device, which asks for less motion.'
        : 'Panels, the diagram and the dialogs change at once instead of moving.'
    "
  >
    <SettingsSwitch
      :model-value="reduceMotion || systemReducesMotion"
      :disabled="systemReducesMotion"
      v-bind="named"
      @update:model-value="reduceMotion = $event"
    />
  </SettingsRow>
</template>
