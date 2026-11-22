<script setup lang="ts">
import { Check, Play, Plus } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import type { KeyHint } from '@/ui/builderKeys';

defineProps<{
  /** The keys that do something right now; see builderKeys.ts. */
  hints: KeyHint[];
  /** Whether the words in the box make a whole instruction. */
  complete: boolean;
  /** The line a new instruction would be added at: `L4`. */
  insertLabel: string;
  /** The program line being edited, which the instruction replaces; null when none is. */
  editingLabel: string | null;
}>();

const emit = defineEmits<{ add: []; run: []; replace: []; cancel: [] }>();
</script>

<!-- The foot of the builder: the keys that work now, and what to do with the instruction. -->
<template>
  <!-- In a narrow pane the buttons take a row of their own rather than being cut off. -->
  <CardFooter class="builder-actions flex-wrap justify-between gap-x-3 gap-y-2">
    <div class="hidden items-center gap-3 text-xs text-muted-foreground sm:flex touch:hidden">
      <span v-for="keyHint in hints" :key="keyHint.label" class="flex items-center gap-1.5">
        <KbdGroup
          ><Kbd v-for="key in keyHint.keys" :key="key">{{ key }}</Kbd></KbdGroup
        >
        {{ keyHint.label }}
      </span>
    </div>
    <div v-if="editingLabel" class="ml-auto flex gap-2">
      <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="emit('cancel')">
        Cancel
      </Button>
      <Button
        size="sm"
        class="quiet-disabled px-3 pointer-coarse:h-11 hover:bg-primary/85 disabled:opacity-100"
        :disabled="!complete"
        @click="emit('replace')"
      >
        <Check />
        Replace {{ editingLabel }}
      </Button>
    </div>
    <div v-else class="ml-auto flex gap-2">
      <!-- Not yet usable is said by colour, not by fading: a faded button reads as broken. -->
      <Button
        variant="outline"
        size="sm"
        class="quiet-disabled pointer-coarse:h-11 disabled:opacity-100"
        :disabled="!complete"
        @click="emit('add')"
      >
        <Plus />
        Add at {{ insertLabel }}
      </Button>
      <Button
        size="sm"
        class="quiet-disabled px-3 pointer-coarse:h-11 hover:bg-primary/85 disabled:opacity-100"
        :disabled="!complete"
        @click="emit('run')"
      >
        <Play />
        Run now
      </Button>
    </div>
  </CardFooter>
</template>
