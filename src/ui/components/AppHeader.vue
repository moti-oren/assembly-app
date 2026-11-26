<script setup lang="ts">
import { BookOpen, Columns3, Ellipsis, PanelLeft, Puzzle, Share2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ARCHITECTURE_CHOICES } from '@/ui/architectures';
import { useChallenges } from '@/ui/useChallenges';
import { useComparison } from '@/ui/useComparison';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { usePreferences } from '@/ui/usePreferences';
import { useShare } from '@/ui/useShare';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import HeaderExampleItems from './HeaderExampleItems.vue';
import HeaderShell from './HeaderShell.vue';
import SheetExamples from './SheetExamples.vue';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
  /** Lines of the program on show; an empty one has nothing to share. */
  programLength: number;
}>();
const emit = defineEmits<{ loadExample: [index: number]; commands: [] }>();
/** The examples menu, which the empty program panel can also open. */
const examplesOpen = defineModel<boolean>('examplesOpen', { default: false });

const { architecture } = usePreferences();
const { open: comparisonOpen } = useComparison();
const { open: challengesOpen } = useChallenges();
const { open: shareOpen } = useShare();
const mode = useLayoutMode();
const { drawerOpen } = useWorkbenchView();

/** From a phone's sheet, which closes first: the comparison is a dialog of its own. */
function compareFromMenu(): void {
  examplesOpen.value = false;
  comparisonOpen.value = true;
}

function challengesFromMenu(): void {
  examplesOpen.value = false;
  challengesOpen.value = true;
}

function shareFromMenu(): void {
  examplesOpen.value = false;
  shareOpen.value = true;
}

function loadFromMenu(index: number): void {
  examplesOpen.value = false;
  emit('loadExample', index);
}
</script>

<!-- The header of the CPU topic: which CPU, sharing, the comparison and the examples. -->
<template>
  <HeaderShell
    v-model:menu-open="examplesOpen"
    :badge="ARCHITECTURE_CHOICES.find((choice) => choice.id === architecture)?.badge ?? ''"
    menu-label="Topics, share, compare, examples and settings"
    @commands="$emit('commands')"
  >
    <template #lead>
      <!-- On a tablet the sidebar is a drawer over the stage; this opens and closes it. -->
      <Button
        v-if="mode === 'tablet'"
        variant="outline"
        size="sm"
        class="pointer-coarse:h-11"
        :class="drawerOpen ? 'border-foreground/60 bg-muted text-foreground' : ''"
        :aria-pressed="drawerOpen"
        data-drawer-toggle
        aria-label="Code: the instruction and the program"
        @click="drawerOpen = !drawerOpen"
      >
        <PanelLeft />
        Code
      </Button>
    </template>
    <template #context>
      <ArchitectureSwitch />
    </template>
    <template #actions>
      <!-- What is done now and then sits in one menu, so the bar keeps to the examples. -->
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="pointer-coarse:h-11 pointer-coarse:min-w-11"
            aria-label="More: share, compare and challenges"
            data-share-opener
          >
            <Ellipsis />
            <span class="hidden xl:inline">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-64">
          <DropdownMenuItem
            class="items-start [&_svg]:mt-0.5"
            :disabled="programLength === 0"
            @select="shareOpen = true"
          >
            <Share2 />
            <span class="flex flex-col">
              Share this program
              <span class="text-xs text-muted-foreground">{{
                programLength === 0 ? 'The program is empty' : 'A link that opens this program'
              }}</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem class="items-start [&_svg]:mt-0.5" @select="comparisonOpen = true">
            <Columns3 />
            <span class="flex flex-col">
              Compare the CPUs
              <span class="text-xs text-muted-foreground">One task on all three CPUs</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem class="items-start [&_svg]:mt-0.5" @select="challengesOpen = true">
            <Puzzle />
            <span class="flex flex-col">
              Challenges
              <span class="text-xs text-muted-foreground">Small tasks, checked as you go</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu v-model:open="examplesOpen" :modal="false">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="pointer-coarse:h-11 pointer-coarse:min-w-11"
            aria-label="Examples"
          >
            <BookOpen />
            <span class="hidden xl:inline">Examples</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-72">
          <HeaderExampleItems :examples="examples" @load="$emit('loadExample', $event)" />
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
    <template #menu-actions>
      <button
        type="button"
        class="sheet-row"
        :disabled="programLength === 0"
        @click="shareFromMenu"
      >
        <Share2 aria-hidden="true" />
        Share this program
        <span v-if="programLength === 0" class="ml-auto text-xs">The program is empty</span>
      </button>
      <button type="button" class="sheet-row" @click="compareFromMenu">
        <Columns3 aria-hidden="true" />
        Compare the CPUs
      </button>
      <button type="button" class="sheet-row" @click="challengesFromMenu">
        <Puzzle aria-hidden="true" />
        Challenges
      </button>
    </template>
    <template #menu>
      <div class="flex min-h-0 flex-1 flex-col gap-1 border-t pt-2">
        <SheetExamples :examples="examples" @load="loadFromMenu" />
      </div>
    </template>
  </HeaderShell>
</template>
