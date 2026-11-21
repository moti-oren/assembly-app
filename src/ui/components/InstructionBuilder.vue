<script setup lang="ts" generic="Action, Instruction">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { formatLabel } from '@/core/shared/program';
import { ChevronDown, CircleAlert, Play, Plus } from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import type { BuilderOption, InstructionGrammar } from '@/ui/builderGrammar';
import { keyHints } from '@/ui/builderKeys';
import { sound } from '@/ui/soundEngine';
import { isApple } from '@/ui/platform';
import { useOptionArrows } from '@/ui/useBuilderArrows';
import { useBuilderOptions } from '@/ui/useBuilderOptions';
import { useInstructionDraft } from '@/ui/useInstructionDraft';
import BuilderOptions from './BuilderOptions.vue';
import BuilderTokenBox from './BuilderTokenBox.vue';

const props = defineProps<{
  /** What the words of an instruction can be, on this architecture. */
  grammar: InstructionGrammar<Action, Instruction>;
  /** Runs the instructions; returns false when the CPU rejected them. */
  run: (instructions: Instruction[]) => boolean;
  /** Adds the instructions to the program at `insertLine`. */
  add: (instructions: Instruction[]) => void;
  error: string | null;
  /** The program, formatted, so jumps can offer its lines as targets. */
  programLines: string[];
  insertLine: number;
}>();

const emit = defineEmits<{
  /** The instructions as built so far, once they are complete; null while they are not. */
  draft: [instructions: Instruction[] | null];
}>();

// The grammar is fixed for the life of the builder: a new architecture gets a new builder.
const draft = useInstructionDraft(props.grammar);
const { complete, built, tokens } = draft;
const filter = ref('');
const card = ref<{ $el: HTMLElement } | null>(null);
const box = useTemplateRef('box');

const options = useBuilderOptions(props.grammar, draft, filter, () => props.programLines);
const { hovered, groups, doesNotFit, hint, moreToChoose, orderedOptions, enterOption, preview } =
  options;

const onOptionArrow = useOptionArrows({
  card: () => card.value?.$el ?? null,
  count: () => orderedOptions.value.length,
  active: () => enterOption.value !== null,
  selectedIndex: options.selectedIndex
});

/**
 * Set while the program is being stepped, so the program below moves up and the line at IP
 * stays in view. Only working in the builder opens the choices again: a click, a key or typing.
 * Focus alone does not, since the command palette hands focus back as it closes.
 */
const folded = ref(false);

/** Folds the choices, unless someone is using the builder right now. */
function fold(): void {
  if (!card.value?.$el.contains(document.activeElement)) folded.value = true;
}

function unfold(): void {
  folded.value = false;
}

/** Ctrl+K and other shortcuts reach the builder too, but they are not work in it. */
function onKeydown(event: KeyboardEvent): void {
  if (!event.ctrlKey && !event.metaKey) unfold();
}

/** The keys that do something right now, for the row under the builder. */
const hints = computed(() =>
  keyHints({
    boxBusy: tokens.value.length > 0 || filter.value !== '',
    enterRuns: complete.value && filter.value.trim() === '',
    canPick: enterOption.value !== null,
    canMove: enterOption.value !== null && orderedOptions.value.length > 1,
    altKey: isApple ? '⌥' : 'Alt'
  })
);

const focusInput = (): void => box.value?.focus();

// Not on a touch screen: focusing there opens the on-screen keyboard over half the page.
onMounted(() => {
  if (!window.matchMedia('(pointer: coarse)').matches) focusInput();
});

defineExpose({
  focus: () => {
    unfold();
    focusInput();
  },
  fold
});

function choose(option: BuilderOption<Action>): void {
  sound.play('pick');
  draft.apply(option.action);
  hovered.value = null;
  filter.value = '';
  focusInput();
}

/** Removes the token at `index` and everything after it. */
function truncateTo(index: number): void {
  if (index === 0) {
    clear();
    return;
  }
  draft.truncateTo(index);
  sound.play('pick');
  focusInput();
}

function clear(): void {
  draft.clear();
  filter.value = '';
  focusInput();
}

watch(built, (instructions) => emit('draft', instructions));

/** Runs the instructions now, or adds them to the program. */
function submit(toProgram: boolean): void {
  const instructions = built.value;
  if (!instructions) return;
  if (toProgram) {
    props.add(instructions);
    clear();
  } else if (props.run(instructions)) {
    clear();
  }
}

function onEnter(event: KeyboardEvent): void {
  if (complete.value && filter.value.trim() === '') {
    submit(event.shiftKey);
    return;
  }
  if (enterOption.value) choose(enterOption.value);
}
</script>

<template>
  <Card ref="card" @pointerdown="unfold" @keydown="onKeydown">
    <CardHeader>
      <CardTitle>Instruction</CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <BuilderTokenBox
        ref="box"
        v-model:filter="filter"
        :tokens="tokens"
        :placeholder="moreToChoose ? hint : 'Ready to run'"
        :invalid="doesNotFit"
        @truncate="truncateTo"
        @clear="clear"
        @enter="onEnter"
        @back="tokens.length > 0 && truncateTo(tokens.length - 1)"
        @option-arrow="onOptionArrow"
      />

      <!-- With the choices folded away their button shares this line, so the fold leaves no gap. -->
      <div class="flex items-baseline gap-3">
        <p class="min-h-5 min-w-0 flex-1 truncate text-sm text-muted-foreground" aria-live="polite">
          <template v-if="doesNotFit">
            <span class="text-destructive">{{ hint }}</span>
          </template>
          <template v-else-if="preview">
            <span class="mr-2 font-mono font-semibold text-foreground">{{ preview.label }}</span>
            {{ preview.text }}
          </template>
        </p>
        <button
          v-if="moreToChoose && folded"
          type="button"
          class="flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          @click="unfold"
        >
          Show the choices
          <ChevronDown class="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <Alert v-if="error" variant="destructive" role="alert">
        <CircleAlert />
        <AlertDescription class="text-destructive/90">{{ error }}</AlertDescription>
      </Alert>

      <BuilderOptions
        v-if="moreToChoose && !folded"
        :groups="groups"
        :enter-option="enterOption"
        :filter="filter"
        :does-not-fit="doesNotFit"
        :hint="hint"
        @choose="choose"
        @hover="hovered = $event"
      />
      <div v-else-if="!moreToChoose" class="text-sm text-muted-foreground">
        <p>
          Complete. Run it now, or add it to the program at line
          <span class="font-mono text-foreground">{{ formatLabel(insertLine) }}</span>.
        </p>
      </div>
    </CardContent>

    <!-- In a narrow pane the buttons take a row of their own rather than being cut off. -->
    <CardFooter class="builder-actions flex-wrap justify-between gap-x-3 gap-y-2">
      <!-- The keys that do something right now; see builderKeys.ts. -->
      <div class="hidden items-center gap-3 text-xs text-muted-foreground sm:flex touch:hidden">
        <span v-for="keyHint in hints" :key="keyHint.label" class="flex items-center gap-1.5">
          <KbdGroup
            ><Kbd v-for="key in keyHint.keys" :key="key">{{ key }}</Kbd></KbdGroup
          >
          {{ keyHint.label }}
        </span>
      </div>
      <div class="ml-auto flex gap-2">
        <!-- Not yet usable is said by colour, not by fading: a faded button reads as broken. -->
        <Button
          variant="outline"
          size="sm"
          class="quiet-disabled pointer-coarse:h-11 disabled:opacity-100"
          :disabled="!complete"
          @click="submit(true)"
        >
          <Plus />
          Add at {{ formatLabel(insertLine) }}
        </Button>
        <Button
          size="sm"
          class="quiet-disabled px-3 pointer-coarse:h-11 hover:bg-primary/85 disabled:opacity-100"
          :disabled="!complete"
          @click="submit(false)"
        >
          <Play />
          Run now
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>
