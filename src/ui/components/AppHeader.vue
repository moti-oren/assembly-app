<script setup lang="ts">
import { BookOpen, Columns3, Search, Settings2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ARCHITECTURE_CHOICES } from '@/ui/architectures';
import { LOCALE_NAMES, LOCALES } from '@/ui/locale';
import { isApple } from '@/ui/platform';
import { useComparison } from '@/ui/useComparison';
import { useLocale } from '@/ui/useLocale';
import { usePreferences } from '@/ui/usePreferences';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
}>();
defineEmits<{ loadExample: [index: number]; commands: [] }>();
/** The examples menu, which the empty program panel can also open. */
const examplesOpen = defineModel<boolean>('examplesOpen', { default: false });

const { isDark, soundOn, architecture, reduceMotion, systemReducesMotion, toggleTheme } =
  usePreferences();
const { open: comparisonOpen } = useComparison();
const { locale, t } = useLocale();

/** The palette opens with Cmd+K on Apple keyboards, Ctrl+K elsewhere. */
const shortcut = isApple ? '⌘K' : 'Ctrl K';
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
      <!-- On a phone the buttons need the room: the badge goes, and the name shortens before it wraps. -->
      <div class="flex min-w-0 items-center gap-2.5">
        <div
          class="hidden size-7 shrink-0 place-items-center rounded-md bg-foreground font-mono text-2xs font-bold text-background sm:grid"
          aria-hidden="true"
        >
          {{ ARCHITECTURE_CHOICES.find((choice) => choice.id === architecture)?.badge }}
        </div>
        <h1 class="truncate text-base font-semibold tracking-tight">CPU Playground</h1>
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

        <!-- Settings that are changed once in a while, out of the way of the ones used all the time. -->
        <DropdownMenu>
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
            <DropdownMenuCheckboxItem v-model="soundOn">Sound</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem :model-value="isDark" @update:model-value="toggleTheme">
              Dark theme
            </DropdownMenuCheckboxItem>
            <!-- While the system asks for less motion, the app's own setting cannot bring it back. -->
            <DropdownMenuCheckboxItem
              :model-value="reduceMotion || systemReducesMotion"
              :disabled="systemReducesMotion"
              @update:model-value="reduceMotion = !reduceMotion"
            >
              Reduce animations
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
              {{ t.language.label }}
            </DropdownMenuLabel>
            <!-- Each language named in itself, so a reader of either one can find their own. -->
            <DropdownMenuRadioGroup v-model="locale">
              <DropdownMenuRadioItem
                v-for="option in LOCALES"
                :key="option"
                :value="option"
                :lang="option"
              >
                {{ LOCALE_NAMES[option] }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
