<script setup lang="ts">
import { Moon, Sparkles, Volume2 } from '@lucide/vue';
import { usePreferences } from '@/ui/usePreferences';

const { isDark, soundOn, reduceMotion, systemReducesMotion, toggleTheme } = usePreferences();
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
      Reduce animations
      <span class="sheet-switch" aria-hidden="true" />
    </button>
  </div>
</template>
