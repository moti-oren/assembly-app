<script setup lang="ts">
import { ChartNoAxesColumn, Moon, Sparkles, Volume2 } from '@lucide/vue';
import { usePreferences } from '@/ui/usePreferences';

const { isDark, soundOn, analyticsOn, reduceMotion, systemReducesMotion, toggleTheme } =
  usePreferences();
</script>

<!-- The settings as the switches of a phone's sheet, each a tap away. -->
<template>
  <div role="group" aria-label="Settings">
    <button
      type="button"
      class="sheet-row"
      role="switch"
      :aria-checked="soundOn"
      @click="soundOn = !soundOn"
    >
      <Volume2 aria-hidden="true" />
      Sound
      <span class="sheet-switch" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="sheet-row"
      role="switch"
      :aria-checked="isDark"
      @click="toggleTheme"
    >
      <Moon aria-hidden="true" />
      Dark theme
      <span class="sheet-switch" aria-hidden="true" />
    </button>
    <!-- While the system asks for less motion, the app's own setting cannot bring it back. -->
    <button
      type="button"
      class="sheet-row"
      role="switch"
      :aria-checked="reduceMotion || systemReducesMotion"
      :disabled="systemReducesMotion"
      @click="reduceMotion = !reduceMotion"
    >
      <Sparkles aria-hidden="true" />
      <span class="flex flex-col">
        Reduce animations
        <span v-if="systemReducesMotion" class="text-xs text-muted-foreground">
          Set by your device
        </span>
      </span>
      <span class="sheet-switch" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="sheet-row"
      role="switch"
      :aria-checked="analyticsOn"
      @click="analyticsOn = !analyticsOn"
    >
      <ChartNoAxesColumn aria-hidden="true" />
      Share anonymous usage
      <span class="sheet-switch" aria-hidden="true" />
    </button>
  </div>
</template>
