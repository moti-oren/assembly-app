<script setup lang="ts">
import { BookOpen, Columns3, Ellipsis, Puzzle, Share2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useChallenges } from '@/ui/useChallenges';
import { useComparison } from '@/ui/useComparison';
import { useShare } from '@/ui/useShare';
import HeaderExampleItems from './HeaderExampleItems.vue';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
  /** Lines of the program on show; an empty one has nothing to share. */
  programLength: number;
}>();
defineEmits<{ loadExample: [index: number] }>();
/** The examples menu, which the empty program panel can also open. */
const examplesOpen = defineModel<boolean>('examplesOpen', { default: false });

const { open: comparisonOpen } = useComparison();
const { open: challengesOpen } = useChallenges();
const { open: shareOpen } = useShare();
</script>

<!--
  The CPU's buttons in the header on a desktop: the examples, and one More menu with sharing,
  the comparison and the challenges, which are done now and then.
-->
<template>
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
