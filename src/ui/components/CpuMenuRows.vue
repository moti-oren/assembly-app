<script setup lang="ts">
import { Columns3, Puzzle, Share2 } from '@lucide/vue';
import { useChallenges } from '@/ui/useChallenges';
import { useComparison } from '@/ui/useComparison';
import { useShare } from '@/ui/useShare';

defineProps<{
  /** Lines of the program on show; an empty one has nothing to share. */
  programLength: number;
}>();
/** The header's menu, which closes first: each row opens a dialog of its own. */
const menuOpen = defineModel<boolean>('menuOpen', { required: true });

const dialogs = {
  share: useShare().open,
  compare: useComparison().open,
  challenges: useChallenges().open
};

function openFromMenu(dialog: keyof typeof dialogs): void {
  menuOpen.value = false;
  dialogs[dialog].value = true;
}
</script>

<!-- The CPU's rows in the header's menu below a desktop: sharing, the comparison, challenges. -->
<template>
  <button
    type="button"
    class="sheet-row"
    :disabled="programLength === 0"
    @click="openFromMenu('share')"
  >
    <Share2 aria-hidden="true" />
    Share this program
    <span v-if="programLength === 0" class="ml-auto text-xs">The program is empty</span>
  </button>
  <button type="button" class="sheet-row" @click="openFromMenu('compare')">
    <Columns3 aria-hidden="true" />
    Compare the CPUs
  </button>
  <button type="button" class="sheet-row" @click="openFromMenu('challenges')">
    <Puzzle aria-hidden="true" />
    Challenges
  </button>
</template>
