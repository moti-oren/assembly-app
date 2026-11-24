<script setup lang="ts" generic="Action, Instruction">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { formatLabel } from '@/core/shared/program';
import { ChevronDown, CircleAlert } from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BuilderOption, InstructionGrammar } from '@/ui/builderGrammar';
import { keyHints } from '@/ui/builderKeys';
import { sound } from '@/ui/soundEngine';
import { isApple } from '@/ui/platform';
import { useOptionArrows } from '@/ui/useBuilderArrows';
import { useBuilderOptions } from '@/ui/useBuilderOptions';
import { useInstructionDraft } from '@/ui/useInstructionDraft';
import BuilderActions from './BuilderActions.vue';
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
  /** The program line being edited, which the builder holds and Enter replaces; null if none. */
  editing?: { line: number; instruction: Instruction } | null;
  /** Puts the instructions in place of the line being edited. */
  replace?: (instructions: Instruction[]) => void;
}>();

const emit = defineEmits<{
  /** The instructions as built so far, once they are complete; null while they are not. */
  draft: [instructions: Instruction[] | null];
  /** Leaves the line being edited as it was. */
  cancelEdit: [];
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

// A word typed whole, then a space or a comma, is picked as if Enter had been pressed, and what
// was typed after it carries on: `mov ax 3` and `lw a0, 8(sp)` read as they are written.
watch(filter, (text) => {
  const finished = options.finishedWord(text);
  if (!finished) return;
  choose(finished.option);
  filter.value = finished.rest;
});

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

/** What the box says once the instruction is whole: what Enter will do with it. */
const readyHint = computed(() =>
  props.editing ? `Ready to replace ${formatLabel(props.editing.line)}` : 'Ready to run'
);

/** The keys that do something right now, for the row under the builder. */
const hints = computed(() =>
  keyHints({
    boxBusy: tokens.value.length > 0 || filter.value !== '',
    enterRuns: complete.value && filter.value.trim() === '',
    canPick: enterOption.value !== null,
    canMove: enterOption.value !== null && orderedOptions.value.length > 1,
    altKey: isApple ? '⌥' : 'Alt',
    editing: !!props.editing
  })
);

const focusInput = (): void => box.value?.focus();

const onTouchScreen = (): boolean => window.matchMedia('(pointer: coarse)').matches;

/**
 * The page opens ready to type, without the focus ring: nobody put the focus there yet. Not on
 * a touch screen: focusing there opens the on-screen keyboard over half the page.
 */
function focusInputOnLoad(): void {
  // A dialog that opened first (a shared link asking) keeps the focus: this workbench loads late.
  const dialogOpen = document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
  if (!onTouchScreen() && !dialogOpen) box.value?.focus({ quiet: true });
}

/**
 * Brings the focus to the builder when an edit starts or ends. On a touch screen that is the
 * card itself, not its input: a screen reader lands on the builder and no keyboard opens.
 */
function focusBuilder(): void {
  if (onTouchScreen()) card.value?.$el.focus();
  else focusInput();
}

/**
 * After a pick, the button that was pressed or the word that was removed is gone: the focus goes
 * back to the builder. Typing goes on where it was; a tap on a touch screen opens no keyboard.
 */
function refocus(): void {
  if (
    card.value?.$el.contains(document.activeElement) &&
    document.activeElement?.tagName === 'INPUT'
  )
    return;
  focusBuilder();
}

onMounted(focusInputOnLoad);

defineExpose({
  focus: () => {
    unfold();
    focusInput();
  },
  fold,
  /** Empties the box: what it held has run. */
  clear: () => clear()
});

function choose(option: BuilderOption<Action>): void {
  sound.play('pick');
  draft.apply(option.action);
  hovered.value = null;
  filter.value = '';
  refocus();
}

/** Removes the token at `index` and everything after it. */
function truncateTo(index: number): void {
  if (index === 0) {
    clear();
    return;
  }
  draft.truncateTo(index);
  sound.play('pick');
  refocus();
}

function clear(): void {
  draft.clear();
  filter.value = '';
  refocus();
}

/** Esc and the clear button: they empty the box, which gives up the edit of a line too. */
function clearOrCancel(): void {
  if (props.editing) emit('cancelEdit');
  clear();
}

// A line to edit fills the box with its words. When the edit ends, replaced or given up from
// anywhere (the program changed under it), the box empties again.
watch(
  () => props.editing,
  (editing, before) => {
    if (editing) {
      draft.load(editing.instruction);
      filter.value = '';
      unfold();
      focusBuilder();
      // On a phone the builder is above the line that was tapped, often out of sight.
      card.value?.$el.scrollIntoView({ block: 'nearest' });
    } else if (before) {
      draft.clear();
      filter.value = '';
      // Cancel and Replace are taken away with the edit: focus that was on them goes to the box.
      if (card.value?.$el.contains(document.activeElement)) focusBuilder();
    }
  }
);

watch(built, (instructions) => emit('draft', instructions));

/** Runs the instructions now, or adds them to the program. */
function submit(toProgram: boolean): void {
  const instructions = built.value;
  if (!instructions) return;
  if (props.editing) {
    props.replace?.(instructions);
    return;
  }
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
  <Card ref="card" tabindex="-1" class="outline-none" @pointerdown="unfold" @keydown="onKeydown">
    <CardHeader>
      <CardTitle>Instruction</CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <!-- What Enter will do is not what it usually does: say so before the box, not after. -->
      <p v-if="editing" class="flex items-baseline gap-2 text-sm" role="status">
        <span class="font-medium">Editing {{ formatLabel(editing.line) }}</span>
        <span class="min-w-0 truncate font-mono text-xs text-muted-foreground">{{
          programLines[editing.line]
        }}</span>
      </p>
      <BuilderTokenBox
        ref="box"
        v-model:filter="filter"
        :tokens="tokens"
        :placeholder="moreToChoose ? hint : readyHint"
        :invalid="doesNotFit"
        @truncate="truncateTo"
        @clear="clearOrCancel"
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
        <AlertDescription class="text-destructive">{{ error }}</AlertDescription>
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
        <p v-if="editing">
          Complete. Replace line
          <span class="font-mono text-foreground">{{ formatLabel(editing.line) }}</span> with it, or
          cancel to leave the line as it was.
        </p>
        <p v-else>
          Complete. Run it now, or add it to the program at line
          <span class="font-mono text-foreground">{{ formatLabel(insertLine) }}</span>.
        </p>
      </div>
    </CardContent>

    <BuilderActions
      :hints="hints"
      :complete="complete"
      :insert-label="formatLabel(insertLine)"
      :editing-label="editing ? formatLabel(editing.line) : null"
      @add="submit(true)"
      @run="submit(false)"
      @replace="submit(false)"
      @cancel="clearOrCancel"
    />
  </Card>
</template>
