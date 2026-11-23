<script setup lang="ts">
import { usePreferences } from '@/ui/usePreferences';
import { PREDICTOR_OPTIONS } from '@/ui/rv32Pipeline';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import SettingsChoice from './SettingsChoice.vue';
import SettingsRow from './SettingsRow.vue';
import SettingsSwitch from './SettingsSwitch.vue';

const { cpuView, registerBits } = usePreferences();
const pipeline = useRv32Pipeline();

const VIEWS = [
  { value: 'diagram', label: 'Diagram' },
  { value: 'table', label: 'Tables' }
] as const;
</script>

<!-- The switches of the CPU's own panels, which stay there too: here they are found in one place. -->
<template>
  <SettingsRow
    v-slot="{ named }"
    label="CPU view"
    description="The CPU as one wired diagram, or as separate register and flag tables."
  >
    <SettingsChoice v-model="cpuView" :options="VIEWS" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Register bits"
    description="8086: the diagram spells each register out in bits, beside its hex and decimal."
  >
    <SettingsSwitch v-model="registerBits" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Pipeline chart"
    description="RISC-V: the executed instructions overlapped in the five-stage pipeline, in place of the cycle strip."
  >
    <SettingsSwitch v-model="pipeline.shown.value" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Forwarding"
    description="RISC-V: the pipeline forwards a result to the instruction behind it. Off, that instruction stalls until write back."
  >
    <SettingsSwitch v-model="pipeline.forwarding.value" v-bind="named" />
  </SettingsRow>
  <SettingsRow
    v-slot="{ named }"
    label="Branch predictor"
    description="RISC-V: what the pipeline fetches behind a branch before it decides: always the next lines, always its target, or what the branch did before (1 bit: last time; 2 bits: mostly)."
  >
    <SettingsChoice
      v-model="pipeline.predictor.value"
      :options="PREDICTOR_OPTIONS"
      v-bind="named"
    />
  </SettingsRow>
</template>
