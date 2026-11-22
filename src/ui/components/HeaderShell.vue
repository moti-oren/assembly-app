<script setup lang="ts">
import { Ellipsis, Search, Settings2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { isApple } from '@/ui/platform';
import { TOPIC_CHOICES } from '@/ui/topics';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useTopic } from '@/ui/useTopic';
import HeaderSettingsItems from './HeaderSettingsItems.vue';
import TopicSwitch from './TopicSwitch.vue';

defineProps<{
  /** Two letters on the chip beside the name: what is on show. */
  badge: string;
  /** What a phone's one menu holds, for a screen reader. */
  menuLabel: string;
}>();
defineEmits<{ commands: [] }>();
/** A phone's one menu, which the page can also open. */
const menuOpen = defineModel<boolean>('menuOpen', { default: false });

const mode = useLayoutMode();
const { topic } = useTopic();

/** The palette opens with Cmd+K on Apple keyboards, Ctrl+K elsewhere. */
const shortcut = isApple ? '⌘K' : 'Ctrl K';
</script>

<!--
  The bar every topic has: the name, the topics, the commands and the settings. A topic puts its
  own switch in `context`, its buttons in `actions`, and on a phone its menu items in `menu`.
-->
<template>
  <!-- Part of the shell, where only the panes scroll. -->
  <header class="relative z-(--z-sticky) flex-none border-b bg-card">
    <!-- The last button is an icon with no edge of its own: more room on its side sets it in. -->
    <div class="flex h-12 items-center gap-3 pr-5 pl-4 max-sm:gap-2 max-sm:px-3">
      <slot name="lead" />
      <!-- A phone needs the room for the buttons: the name goes first, then on the narrowest the mark. -->
      <!-- Below a desktop it is the mark alone, which keeps its width in a crowded bar. -->
      <div class="flex min-w-0 items-center gap-2.5 max-lg:shrink-0">
        <div class="die-mark hidden shrink-0 min-[25rem]:grid" aria-hidden="true">{{ badge }}</div>
        <h1 class="truncate text-sm font-semibold tracking-tight max-lg:sr-only">CPU Playground</h1>
      </div>
      <!-- A phone has no room for two switches: there the topics are in the menu. -->
      <TopicSwitch v-if="mode !== 'phone'" />
      <slot name="context" />

      <div class="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          class="mr-1 text-muted-foreground max-sm:mr-0 pointer-coarse:h-11 pointer-coarse:min-w-11"
          aria-label="Commands"
          aria-keyshortcuts="Control+K Meta+K"
          @click="$emit('commands')"
        >
          <Search />
          <span class="hidden sm:inline">Commands</span>
          <!-- A screen worked by touch has no keyboard to press it on. -->
          <Kbd class="hidden sm:inline-flex touch:hidden">{{ shortcut }}</Kbd>
        </Button>

        <template v-if="mode !== 'phone'">
          <slot name="actions" />
          <DropdownMenu :modal="false">
            <!-- No tooltip: wrapped around the menu's trigger, it breaks where the menu opens. -->
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="pointer-coarse:size-11"
                aria-label="Settings"
                title="Settings"
              >
                <Settings2 />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <HeaderSettingsItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </template>

        <!-- A phone has room for one menu: the topics, the topic's own items and the settings. -->
        <DropdownMenu v-else v-model:open="menuOpen" :modal="false">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              :aria-label="menuLabel"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-72 max-w-[calc(100vw-1.5rem)]">
            <DropdownMenuItem
              v-for="choice in TOPIC_CHOICES.filter((each) => each.id !== topic)"
              :key="choice.id"
              class="pointer-coarse:py-2.5"
              @select="topic = choice.id"
            >
              Go to {{ choice.name }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <slot name="menu" />
            <HeaderSettingsItems />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
