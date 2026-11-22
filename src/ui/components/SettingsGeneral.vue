<script setup lang="ts">
import { usePreferences } from '@/ui/usePreferences';
import SettingsRow from './SettingsRow.vue';
import SettingsSwitch from './SettingsSwitch.vue';

const { soundOn, analyticsOn } = usePreferences();
</script>

<template>
  <SettingsRow
    v-slot="{ named }"
    label="Sound"
    description="A short sound for each step, undo, error and edit."
  >
    <SettingsSwitch v-model="soundOn" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Share anonymous usage"
    description="Counts which CPUs and features are used. Nothing you write is ever sent."
  >
    <SettingsSwitch v-model="analyticsOn" v-bind="named" />
  </SettingsRow>
</template>
