<script setup lang="ts">
import { BookOpen, Columns3, Moon, RotateCcw, Search, Sun, Volume2, VolumeX } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ARCHITECTURE_CHOICES } from '@/ui/architectures';
import { useComparison } from '@/ui/useComparison';
import { usePreferences } from '@/ui/usePreferences';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
}>();
defineEmits<{ reset: []; loadExample: [index: number]; commands: [] }>();
/** The examples menu, which the empty program panel can also open. */
const examplesOpen = defineModel<boolean>('examplesOpen', { default: false });

const { isDark, soundOn, architecture, toggleTheme } = usePreferences();
const { open: comparisonOpen } = useComparison();

/** The palette opens with Cmd+K on Apple keyboards, Ctrl+K elsewhere. */
const shortcut = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  ? '⌘K'
  : 'Ctrl K';
</script>

<template>
  <!--
    Stays on screen only with two columns. On a phone or tablet it scrolls away and leaves the
    room to the panels; the change strip takes its place at the top.
  -->
  <header
    class="relative z-(--z-sticky) border-b bg-background/85 backdrop-blur-sm lg:sticky lg:top-0"
  >
    <div class="mx-auto flex h-14 max-w-(--page-width) items-center gap-3 px-4 lg:px-6">
      <!--
        On a phone the buttons need the room: the badge goes, and the name shortens before it
        wraps. From md the tagline is on show, and it is the one that shortens.
      -->
      <div class="flex min-w-0 items-center gap-2.5 md:shrink-0">
        <div
          class="hidden size-7 shrink-0 place-items-center rounded-md bg-foreground font-mono text-2xs font-bold text-background sm:grid"
          aria-hidden="true"
        >
          {{ ARCHITECTURE_CHOICES.find((choice) => choice.id === architecture)?.badge }}
        </div>
        <h1 class="truncate text-[15px] font-semibold tracking-tight">CPU Playground</h1>
      </div>
      <!-- Each CPU keeps its own program and history, so switching back finds them as they were. -->
      <div class="flex shrink-0 rounded-md border p-0.5" role="group" aria-label="Architecture">
        <Button
          v-for="choice in ARCHITECTURE_CHOICES"
          :key="choice.id"
          :variant="architecture === choice.id ? 'secondary' : 'ghost'"
          size="sm"
          class="h-7 px-2.5 text-xs pointer-coarse:h-11"
          :class="{ 'font-semibold': architecture === choice.id }"
          :aria-pressed="architecture === choice.id"
          @click="architecture = choice.id"
        >
          {{ choice.label }}
        </Button>
      </div>
      <p class="hidden truncate text-sm text-muted-foreground md:block">
        Build an instruction, run it, and watch the CPU change.
      </p>

      <div class="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          class="mr-1 text-muted-foreground pointer-coarse:h-11"
          aria-label="Commands"
          aria-keyshortcuts="Control+K Meta+K"
          @click="$emit('commands')"
        >
          <Search />
          <span class="hidden sm:inline">Commands</span>
          <Kbd class="hidden sm:inline-flex">{{ shortcut }}</Kbd>
        </Button>
        <!-- Narrower headers have no room for it: there the palette opens the comparison. -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="hidden pointer-coarse:h-11 lg:inline-flex"
              aria-label="Compare the CPUs"
              @click="comparisonOpen = true"
            >
              <Columns3 />
              <span>Compare</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>The same task on all three CPUs, side by side</TooltipContent>
        </Tooltip>
        <DropdownMenu v-model:open="examplesOpen">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="sm" class="pointer-coarse:h-11" aria-label="Examples">
              <BookOpen />
              <span class="hidden sm:inline">Examples</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-72">
            <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
              Replaces your program and clears the CPU and its history
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="(example, index) in examples"
              :key="example.name"
              class="flex-col items-start gap-0.5"
              @select="$emit('loadExample', index)"
            >
              <span class="font-medium">{{ example.name }}</span>
              <span class="text-xs text-muted-foreground">{{ example.description }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="pointer-coarse:h-11"
              aria-label="Reset the CPU"
              @click="$emit('reset')"
            >
              <RotateCcw />
              <span class="hidden sm:inline">Reset</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Clears registers, flags, memory and the history. The program is kept.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              :aria-label="soundOn ? 'Turn sound off' : 'Turn sound on'"
              :aria-pressed="soundOn"
              @click="soundOn = !soundOn"
            >
              <Volume2 v-if="soundOn" />
              <VolumeX v-else />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ soundOn ? 'Turn sound off' : 'Turn sound on' }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
              @click="toggleTheme"
            >
              <Sun v-if="isDark" />
              <Moon v-else />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{
            isDark ? 'Switch to light theme' : 'Switch to dark theme'
          }}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </header>
</template>
