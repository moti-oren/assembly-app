<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { groupBy } from '@/ui/groupBy';
import { Check } from '@lucide/vue';
import { searchText, type PaletteCommand } from '@/ui/paletteCommand';

const props = defineProps<{ commands: PaletteCommand[] }>();
const open = defineModel<boolean>('open', { required: true });

const groups = computed(() => groupBy(props.commands, (command) => command.group));

// A workbench kept alive while another is shown keeps its palette too: only the shown one listens.
const shown = ref(true);
onActivated(() => (shown.value = true));
onDeactivated(() => (shown.value = false));

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!shown.value) return;
  // `code` is the physical key, so the shortcut also works on a non-Latin keyboard layout.
  if (event.code === 'KeyK' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    open.value = !open.value;
  }
});

/** A command waiting for the palette to finish closing. */
let afterClose: PaletteCommand | null = null;

function choose(command: PaletteCommand): void {
  open.value = false;
  if (command.moves) afterClose = command;
  else command.run();
}

function onCloseAutoFocus(event: Event): void {
  const command = afterClose;
  if (!command) return;
  afterClose = null;
  if (command.moves === 'focus') event.preventDefault();
  // This event comes before the dialog lifts its scroll lock, which would swallow a scroll.
  setTimeout(command.run);
}
</script>

<template>
  <!-- CommandDialog, composed here to reach close-auto-focus for commands that move focus. -->
  <Dialog v-model:open="open">
    <DialogContent
      class="command-palette top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0 max-sm:top-3 sm:max-w-xl"
      :show-close-button="false"
      @close-auto-focus="onCloseAutoFocus"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>Commands</DialogTitle>
        <DialogDescription>Search for something to do</DialogDescription>
      </DialogHeader>
      <Command>
        <CommandInput placeholder="Search commands" />
        <!-- On a phone it hangs from the top, as tall as the on-screen keyboard leaves room for. -->
        <CommandList
          class="max-h-[min(24rem,42svh)] max-sm:max-h-[calc(var(--app-height,100dvh)-8.5rem)]"
        >
          <CommandEmpty class="py-10 text-muted-foreground">No command matches.</CommandEmpty>
          <CommandGroup v-for="[group, items] in groups" :key="group" :heading="group">
            <CommandItem
              v-for="command in items"
              :key="command.label"
              class="px-3 py-2.5 pointer-coarse:min-h-11"
              :value="`${group} ${command.label}`"
              :disabled="command.disabled"
              :aria-disabled="command.disabled || undefined"
              :aria-current="command.current || undefined"
              @select="choose(command)"
            >
              <!-- The words a search is matched against: never shown, and never read out. -->
              <span hidden>{{ searchText(command) }}</span>
              {{ command.label }}
              <Check v-if="command.current" class="size-4" aria-hidden="true" />
              <span v-if="command.current" class="sr-only">(current)</span>
              <!-- Its shortcut, at the right edge; no use on a screen worked by touch. -->
              <CommandShortcut v-if="command.keys" class="shrink-0 tracking-normal touch:hidden">
                <KbdGroup
                  ><Kbd v-for="key in command.keys" :key="key">{{ key }}</Kbd></KbdGroup
                >
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <!-- Keys to press: of no use on a screen worked by touch. Its line runs edge to edge. -->
        <div
          class="-mx-3 flex items-center gap-4 border-t px-6 pt-3 pb-1 text-xs text-muted-foreground touch:hidden"
        >
          <span class="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span class="flex items-center gap-1.5"><Kbd>Enter</Kbd> run</span>
          <span class="flex items-center gap-1.5"><Kbd>Esc</Kbd> close</span>
        </div>
      </Command>
    </DialogContent>
  </Dialog>
</template>
