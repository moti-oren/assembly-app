<script setup lang="ts">
import { BookOpen, Moon, RotateCcw, Search, Sun, Volume2, VolumeX } from '@lucide/vue';
import { EXAMPLE_PROGRAMS } from '@/core/program';
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
import { usePreferences } from '@/ui/usePreferences';

defineEmits<{ reset: []; loadExample: [index: number]; commands: [] }>();

const { isDark, soundOn, toggleTheme } = usePreferences();
</script>

<template>
  <header class="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-sm">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-6">
      <div class="flex items-center gap-2.5">
        <div
          class="grid size-7 place-items-center rounded-md bg-foreground font-mono text-[11px] font-bold text-background"
          aria-hidden="true"
        >
          86
        </div>
        <h1 class="text-[15px] font-semibold tracking-tight">8086 Playground</h1>
      </div>
      <p class="hidden truncate text-sm text-muted-foreground md:block">
        Build an instruction, run it, and watch the CPU change.
      </p>

      <div class="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          class="mr-1 text-muted-foreground"
          @click="$emit('commands')"
        >
          <Search />
          <span class="hidden sm:inline">Commands</span>
          <Kbd class="hidden sm:inline-flex">Ctrl K</Kbd>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="sm">
              <BookOpen />
              <span class="hidden sm:inline">Examples</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-72">
            <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
              Replaces the program and resets the CPU
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="(example, index) in EXAMPLE_PROGRAMS"
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
            <Button variant="ghost" size="sm" @click="$emit('reset')">
              <RotateCcw />
              <span class="hidden sm:inline">Reset</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clears registers, flags and memory. The program is kept.</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="soundOn ? 'Turn sound off' : 'Turn sound on'"
              :aria-pressed="soundOn"
              @click="soundOn = !soundOn"
            >
              <Volume2 v-if="soundOn" />
              <VolumeX v-else />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ soundOn ? 'Sound on' : 'Sound off' }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
              @click="toggleTheme"
            >
              <Sun v-if="isDark" />
              <Moon v-else />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ isDark ? 'Light theme' : 'Dark theme' }}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </header>
</template>
