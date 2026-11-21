<script setup lang="ts">
import { BookOpen, Columns3, Ellipsis, PanelLeft, Search, Settings2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ARCHITECTURE_CHOICES } from '@/ui/architectures';
import { isApple } from '@/ui/platform';
import { useComparison } from '@/ui/useComparison';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { usePreferences } from '@/ui/usePreferences';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import HeaderExampleItems from './HeaderExampleItems.vue';
import HeaderSettingsItems from './HeaderSettingsItems.vue';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
}>();
defineEmits<{ loadExample: [index: number]; commands: [] }>();
/** The examples menu, which the empty program panel can also open. */
const examplesOpen = defineModel<boolean>('examplesOpen', { default: false });

const { architecture } = usePreferences();
const { open: comparisonOpen } = useComparison();
const mode = useLayoutMode();
const { drawerOpen } = useWorkbenchView();

/** The palette opens with Cmd+K on Apple keyboards, Ctrl+K elsewhere. */
const shortcut = isApple ? '⌘K' : 'Ctrl K';
</script>

<template>
  <!-- Part of the shell, where only the panes scroll. -->
  <header class="relative z-(--z-sticky) flex-none border-b bg-card">
    <div class="flex h-12 items-center gap-3 px-4 max-sm:gap-2 max-sm:px-3">
      <!-- On a tablet the sidebar is a drawer over the stage; this opens and closes it. -->
      <Button
        v-if="mode === 'tablet'"
        variant="outline"
        size="sm"
        class="pointer-coarse:h-11"
        :class="drawerOpen ? 'border-foreground/60 bg-muted text-foreground' : ''"
        :aria-pressed="drawerOpen"
        aria-label="Code: the instruction and the program"
        @click="drawerOpen = !drawerOpen"
      >
        <PanelLeft />
        Code
      </Button>
      <!-- A phone needs the room for the buttons: the name goes first, then on the narrowest the mark. -->
      <div class="flex min-w-0 items-center gap-2.5">
        <div class="die-mark hidden shrink-0 min-[25rem]:grid" aria-hidden="true">
          {{ ARCHITECTURE_CHOICES.find((choice) => choice.id === architecture)?.badge }}
        </div>
        <h1 class="truncate text-sm font-semibold tracking-tight max-sm:sr-only">CPU Playground</h1>
      </div>
      <!-- Each CPU keeps its own program and history, so switching back finds them as they were. -->
      <div
        class="segmented shrink-0"
        :style="{
          '--segments': ARCHITECTURE_CHOICES.length,
          '--active': ARCHITECTURE_CHOICES.findIndex((choice) => choice.id === architecture)
        }"
        role="group"
        aria-label="Architecture"
      >
        <Button
          v-for="choice in ARCHITECTURE_CHOICES"
          :key="choice.id"
          variant="ghost"
          size="sm"
          class="h-7 px-3 text-xs max-sm:px-2 pointer-coarse:h-10"
          :aria-pressed="architecture === choice.id"
          @click="architecture = choice.id"
        >
          {{ choice.label }}
        </Button>
      </div>

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
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="pointer-coarse:h-11 pointer-coarse:min-w-11"
                aria-label="Compare the CPUs"
                @click="comparisonOpen = true"
              >
                <Columns3 />
                <span class="hidden lg:inline">Compare</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>The same task on all three CPUs, side by side</TooltipContent>
          </Tooltip>
          <DropdownMenu v-model:open="examplesOpen" :modal="false">
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="pointer-coarse:h-11 pointer-coarse:min-w-11"
                aria-label="Examples"
              >
                <BookOpen />
                <span class="hidden lg:inline">Examples</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-72">
              <HeaderExampleItems :examples="examples" @load="$emit('loadExample', $event)" />
            </DropdownMenuContent>
          </DropdownMenu>
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

        <!-- A phone has room for one menu: the comparison, the examples and the settings in it. -->
        <DropdownMenu v-else v-model:open="examplesOpen" :modal="false">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              aria-label="Compare, examples and settings"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-72 max-w-[calc(100vw-1.5rem)]">
            <DropdownMenuItem class="pointer-coarse:py-2.5" @select="comparisonOpen = true">
              <Columns3 />
              Compare the CPUs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <HeaderExampleItems :examples="examples" @load="$emit('loadExample', $event)" />
            <DropdownMenuSeparator />
            <HeaderSettingsItems />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
