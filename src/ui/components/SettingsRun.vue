<script setup lang="ts">
import { RUN_SPEED_NAMES, SPEED_LABELS } from '@/ui/runSpeeds';
import { usePreferences } from '@/ui/usePreferences';
import SettingsChoice from './SettingsChoice.vue';
import SettingsRow from './SettingsRow.vue';
import SettingsSwitch from './SettingsSwitch.vue';

const { runSpeed, autoOpenDevices, confirmReset } = usePreferences();

const SPEEDS = RUN_SPEED_NAMES.map((value) => ({ value, label: SPEED_LABELS[value] }));
</script>

<template>
  <SettingsRow
    v-slot="{ named }"
    label="Run speed"
    description="How fast Run steps through a program, on every CPU. Instant runs it to its end at once."
    stacked
  >
    <SettingsChoice v-model="runSpeed" :options="SPEEDS" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Open the I/O panel by itself"
    description="When a program uses a port, its LEDs, switches, digits and terminal come into view."
  >
    <SettingsSwitch v-model="autoOpenDevices" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Ask before a reset"
    description="A reset clears the history, which Undo cannot bring back. Off, it resets at once."
  >
    <SettingsSwitch v-model="confirmReset" v-bind="named" />
  </SettingsRow>
</template>
