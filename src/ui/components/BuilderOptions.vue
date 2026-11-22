<script setup lang="ts" generic="Action">
import { CornerDownLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { BuilderOption } from '@/ui/builderGrammar';

/** The choices for the next word, in their families, with the one Enter would pick marked. */
defineProps<{
  groups: [string, BuilderOption<Action>[]][];
  enterOption: BuilderOption<Action> | null;
  filter: string;
  /** The typed number is too big; that has its own message, so none is shown here. */
  doesNotFit: boolean;
  hint: string;
}>();

const emit = defineEmits<{
  choose: [option: BuilderOption<Action>];
  /** The option under the pointer or keyboard focus, or null when it leaves. */
  hover: [option: BuilderOption<Action> | null];
}>();
</script>

<template>
  <!-- Squeezed, it still shows a heading and a row of choices (--fill-min, sidebar.css). -->
  <div
    data-fill
    class="scroll-fade -mx-1 max-h-[min(21rem,40svh)] scroll-pb-7 overflow-y-auto px-1 [--fill-min:5.5rem]"
  >
    <!-- Families are told apart by their headings and the space between them, not by colour. -->
    <div v-for="[group, options] in groups" :key="group" class="mb-4 last:mb-0">
      <h3 class="mb-2 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {{ group }}
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="option in options"
          :key="option.key"
          variant="outline"
          size="sm"
          class="font-mono pointer-coarse:h-11 pointer-coarse:px-3.5"
          :data-selected="option === enterOption"
          data-option
          :class="
            option === enterOption
              ? 'border-foreground/70 bg-muted text-foreground dark:border-foreground/60 dark:bg-muted'
              : ''
          "
          @click="emit('choose', option)"
          @mouseenter="emit('hover', option)"
          @mouseleave="emit('hover', null)"
          @focus="emit('hover', option)"
          @blur="emit('hover', null)"
        >
          {{ option.label }}
          <!-- A touch screen has no Enter to press, and the mark would widen the one button. -->
          <CornerDownLeft
            v-if="option === enterOption"
            class="text-foreground touch:hidden"
            aria-label="Enter picks this"
          />
        </Button>
      </div>
    </div>
    <p v-if="groups.length === 0 && !doesNotFit" class="text-sm text-muted-foreground">
      <template v-if="filter.trim()">
        Nothing matches “<span class="font-mono break-all text-foreground">{{ filter }}</span
        >”. Press <Kbd>Backspace</Kbd> to edit it or <Kbd>Esc</Kbd> to start over.
      </template>
      <template v-else>{{ hint }}</template>
    </p>
  </div>
</template>
