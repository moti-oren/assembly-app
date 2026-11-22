<script setup lang="ts">
import { computed, type Component } from 'vue';
import { Cpu, Database, Keyboard, Play, SlidersHorizontal, SunMoon } from '@lucide/vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/ui/settingsSections';
import { useSettings } from '@/ui/useSettings';
import SettingsAppearance from './SettingsAppearance.vue';
import SettingsCpu from './SettingsCpu.vue';
import SettingsData from './SettingsData.vue';
import SettingsGeneral from './SettingsGeneral.vue';
import SettingsKeyboard from './SettingsKeyboard.vue';
import SettingsRun from './SettingsRun.vue';

const { open, section } = useSettings();

const PANES: Record<SettingsSectionId, { icon: Component; pane: Component }> = {
  general: { icon: SlidersHorizontal, pane: SettingsGeneral },
  appearance: { icon: SunMoon, pane: SettingsAppearance },
  cpu: { icon: Cpu, pane: SettingsCpu },
  running: { icon: Play, pane: SettingsRun },
  keyboard: { icon: Keyboard, pane: SettingsKeyboard },
  data: { icon: Database, pane: SettingsData }
};

const shown = computed(
  () => SETTINGS_SECTIONS.find((each) => each.id === section.value) ?? SETTINGS_SECTIONS[0]
);

/** On a phone the sections are a row that scrolls: the one chosen comes fully into view. */
function choose(id: SettingsSectionId, event: MouseEvent): void {
  section.value = id;
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

/**
 * What opened the dialog may be gone by the time it closes (the palette, a phone's sheet), so
 * the focus goes back to the header's own way in.
 */
function returnFocus(event: Event): void {
  const opener = document.querySelector<HTMLElement>('[data-settings-opener]');
  if (!opener) return;
  event.preventDefault();
  opener.focus();
}
</script>

<!--
  Every setting of the app in one place: the sections down the side, the rows of the one chosen
  beside them. A phone gives it the whole screen, with the sections as a row that scrolls sideways.
-->
<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:h-[min(34rem,calc(100svh-2rem))] sm:max-w-[min(48rem,calc(100%-2rem))] sm:p-0"
      @close-auto-focus="returnFocus"
    >
      <DialogHeader class="border-b px-4 pt-4 pr-12 pb-4 sm:px-6 sm:pt-5">
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription class="sr-only">
          Sound, theme, the CPU's views, running, the keyboard shortcuts and what is saved.
        </DialogDescription>
      </DialogHeader>

      <div
        class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[11.5rem_minmax(0,1fr)] sm:grid-rows-1"
      >
        <nav
          class="scroll-fade-x flex gap-1 max-sm:overflow-x-auto max-sm:border-b max-sm:px-4 max-sm:py-2 sm:flex-col sm:overflow-y-auto sm:border-r sm:p-3"
          aria-label="Sections"
        >
          <button
            v-for="each in SETTINGS_SECTIONS"
            :key="each.id"
            type="button"
            class="settings-tab"
            :aria-current="each.id === section ? 'true' : undefined"
            @click="choose(each.id, $event)"
          >
            <component :is="PANES[each.id].icon" aria-hidden="true" />
            {{ each.name }}
          </button>
        </nav>

        <section
          class="min-h-0 overflow-y-auto px-4 pt-1 pb-4 sm:px-6 sm:pt-2 sm:pb-6"
          aria-labelledby="settings-section"
        >
          <h3 id="settings-section" class="sr-only">{{ shown.name }}</h3>
          <component :is="PANES[shown.id].pane" />
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
