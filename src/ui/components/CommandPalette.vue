<script setup lang="ts">
import { computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';

export interface PaletteCommand {
  group: string;
  label: string;
  disabled?: boolean;
  run: () => void;
}

const props = defineProps<{ commands: PaletteCommand[] }>();
const open = defineModel<boolean>('open', { required: true });

const groups = computed(() => {
  const byGroup = new Map<string, PaletteCommand[]>();
  for (const command of props.commands) {
    byGroup.set(command.group, [...(byGroup.get(command.group) ?? []), command]);
  }
  return [...byGroup];
});

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  // `code` is the physical key, so the shortcut also works on a non-Latin keyboard layout.
  if (event.code === 'KeyK' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    open.value = !open.value;
  }
});

function choose(command: PaletteCommand): void {
  open.value = false;
  command.run();
}
</script>

<template>
  <CommandDialog
    v-model:open="open"
    title="Commands"
    description="Search for something to do"
    class="command-palette sm:max-w-xl"
  >
    <CommandInput placeholder="Search commands" />
    <CommandList class="max-h-[min(24rem,42svh)]">
      <CommandEmpty class="py-10 text-muted-foreground">No command matches.</CommandEmpty>
      <CommandGroup v-for="[group, items] in groups" :key="group" :heading="group">
        <CommandItem
          v-for="command in items"
          :key="command.label"
          class="px-3 py-2.5"
          :value="`${group} ${command.label}`"
          :disabled="command.disabled"
          @select="choose(command)"
        >
          {{ command.label }}
        </CommandItem>
      </CommandGroup>
    </CommandList>
    <div class="flex items-center gap-4 border-t px-3 pt-3 pb-1 text-xs text-muted-foreground">
      <span class="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
      <span class="flex items-center gap-1.5"><Kbd>Enter</Kbd> run</span>
      <span class="flex items-center gap-1.5"><Kbd>Esc</Kbd> close</span>
    </div>
  </CommandDialog>
</template>
