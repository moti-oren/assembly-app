<script setup lang="ts">
import { BookOpen, Columns3, PanelLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ARCHITECTURE_CHOICES } from '@/ui/architectures';
import { useComparison } from '@/ui/useComparison';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { usePreferences } from '@/ui/usePreferences';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import HeaderExampleItems from './HeaderExampleItems.vue';
import HeaderShell from './HeaderShell.vue';
import SheetExamples from './SheetExamples.vue';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
}>();
const emit = defineEmits<{ loadExample: [index: number]; commands: [] }>();
/** The examples menu, which the empty program panel can also open. */
const examplesOpen = defineModel<boolean>('examplesOpen', { default: false });

const { architecture } = usePreferences();
const { open: comparisonOpen } = useComparison();
const mode = useLayoutMode();
const { drawerOpen } = useWorkbenchView();

/** From a phone's sheet, which closes first: the comparison is a dialog of its own. */
function compareFromMenu(): void {
  examplesOpen.value = false;
  comparisonOpen.value = true;
}

function loadFromMenu(index: number): void {
  examplesOpen.value = false;
  emit('loadExample', index);
}
</script>

<!-- The header of the CPU topic: which CPU, the comparison and the examples. -->
<template>
  <HeaderShell
    v-model:menu-open="examplesOpen"
    :badge="ARCHITECTURE_CHOICES.find((choice) => choice.id === architecture)?.badge ?? ''"
    menu-label="Topics, compare, examples and settings"
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
            <span class="hidden xl:inline">Compare</span>
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
            <span class="hidden xl:inline">Examples</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-72">
          <HeaderExampleItems :examples="examples" @load="$emit('loadExample', $event)" />
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
    <template #menu-actions>
      <button type="button" class="sheet-row" @click="compareFromMenu">
        <Columns3 aria-hidden="true" />
        Compare the CPUs
      </button>
    </template>
    <template #menu>
      <div class="flex min-h-0 flex-1 flex-col gap-1 border-t pt-2">
        <SheetExamples :examples="examples" @load="loadFromMenu" />
      </div>
    </template>
  </HeaderShell>
</template>
