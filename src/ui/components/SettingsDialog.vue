<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
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

/** A screen with no keyboard has no Keyboard tab (touch:hidden): it shows General instead. */
const touchOnly = useMediaQuery('(hover: none) and (pointer: coarse)');
const shown = computed(
  () =>
    SETTINGS_SECTIONS.find(
      (each) => each.id === section.value && !(touchOnly.value && each.id === 'keyboard')
    ) ?? SETTINGS_SECTIONS[0]
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
  beside them. Below a tablet it takes the whole screen, inside the safe area, with the sections
  as a row that scrolls sideways.
-->
<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="settings-dialog grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none sm:max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:pt-[env(safe-area-inset-top)] max-md:pr-[env(safe-area-inset-right)] max-md:pb-[env(safe-area-inset-bottom)] max-md:pl-[env(safe-area-inset-left)] max-md:[&>button]:top-[calc(0.5rem+env(safe-area-inset-top))] max-md:[&>button]:right-[calc(0.5rem+env(safe-area-inset-right))] pointer-coarse:[&>button]:size-11 md:h-[min(34rem,calc(100svh-2rem))] md:max-w-[min(48rem,calc(100%-2rem))] md:p-0"
      @close-auto-focus="returnFocus"
    >
      <DialogHeader class="border-b px-4 pt-4 pr-12 pb-4 md:px-6 md:pt-5">
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription class="sr-only">
          Sound, theme, the CPU's views, running, the keyboard shortcuts and what is saved.
        </DialogDescription>
      </DialogHeader>

      <div
        class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[11.5rem_minmax(0,1fr)] md:grid-rows-1"
      >
        <nav
          class="scroll-fade-x flex gap-1 max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:border-b max-md:px-4 max-md:py-2 md:flex-col md:overflow-y-auto md:border-r md:p-3"
          aria-label="Sections"
        >
          <button
            v-for="each in SETTINGS_SECTIONS"
            :key="each.id"
            type="button"
            class="settings-tab"
            :class="{ 'touch:hidden': each.id === 'keyboard' }"
            :aria-current="each.id === section ? 'true' : undefined"
            @click="choose(each.id, $event)"
          >
            <component :is="PANES[each.id].icon" aria-hidden="true" />
            {{ each.name }}
          </button>
        </nav>

        <section
          class="min-h-0 overflow-y-auto px-4 pt-1 pb-4 md:px-6 md:pt-2 md:pb-6"
          aria-labelledby="settings-section"
        >
          <h3 id="settings-section" class="sr-only">{{ shown.name }}</h3>
          <!--
            A box of their own, so the first row is a first child and draws no line above it;
            keyed, so another section fades in rather than replacing this one at once.
          -->
          <div :key="shown.id" class="fade-arrive">
            <component :is="PANES[shown.id].pane" />
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
