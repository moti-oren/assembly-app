<script setup lang="ts" generic="Action, Instruction">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue';
import { parseNumber } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import { ChevronDown, CircleAlert, CornerDownLeft, Play, Plus, X } from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  filterOptions,
  type BuilderOption,
  type DraftContext,
  type InstructionGrammar
} from '@/ui/builderGrammar';
import { boxMove, keyHints } from '@/ui/builderKeys';
import { rowNeighbour } from '@/ui/gridNavigation';
import { groupBy } from '@/ui/groupBy';
import { isApple } from '@/ui/platform';
import { useTwoColumns } from '@/ui/useTwoColumns';
import { useInstructionDraft } from '@/ui/useInstructionDraft';

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
const { chosen, complete, built, tokens } = draft;
const filter = ref('');
const input = ref<HTMLInputElement | null>(null);
/** The box that holds the words chosen so far and the text input. */
const box = ref<HTMLElement | null>(null);
const card = ref<{ $el: HTMLElement } | null>(null);
/** True while focus is inside the builder. */
const active = ref(false);
/**
 * With two columns the choices do not follow focus: folding them away would move every panel
 * below the builder each time focus came and went, under a pointer that is about to click. In
 * one column they fold away when the builder is not in use, so the CPU panels are not pushed
 * off screen.
 */
const twoColumns = useTwoColumns();
/**
 * With two columns, set while the program is being stepped, so the program below moves up and
 * the line at IP stays in view. Only working in the builder opens them again: a click, a key or
 * typing. Focus alone does not, since the command palette hands focus back as it closes.
 */
const folded = ref(false);
const choicesShown = computed(() => (twoColumns.value ? !folded.value : active.value));

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

function onFocusOut(): void {
  // Focus moves between the input and the choices; only leaving the card counts.
  setTimeout(() => {
    active.value = card.value?.$el.contains(document.activeElement) ?? false;
  });
}
/** The option under the pointer or keyboard focus; its hint is previewed below the input. */
const hovered = shallowRef<BuilderOption<Action> | null>(null);

const typedNumber = computed(() => parseNumber(filter.value));

const context = computed<DraftContext>(() => ({
  typed: typedNumber.value,
  programLines: props.programLines
}));
const allOptions = computed(() => props.grammar.options(chosen.value, context.value));
const visibleOptions = computed(() =>
  filterOptions(allOptions.value, filter.value, typedNumber.value)
);
const groups = computed(() => groupBy(visibleOptions.value, (option) => option.group));

const doesNotFit = computed(() => props.grammar.overflows(chosen.value, context.value));
const hint = computed(() =>
  props.grammar.hint(chosen.value, context.value, filter.value, complete.value)
);

const moreToChoose = computed(() => props.grammar.hasMore(chosen.value));

/** The options in the order they appear on screen (grouped), which the arrow keys walk through. */
const orderedOptions = computed(() => groups.value.flatMap(([, options]) => options));

/** Index into `orderedOptions` of the option the arrow keys moved to; Enter picks it. */
const selectedIndex = ref(0);

// A new list of options (typing, or a word chosen) starts again from the first one.
watch(visibleOptions, () => {
  selectedIndex.value = 0;
});

/** The option Enter would pick. */
const enterOption = computed(() =>
  complete.value && !filter.value.trim()
    ? null
    : (orderedOptions.value[selectedIndex.value] ?? null)
);

/** Arrows walk the options: Left/Right one at a time, Up/Down by row. */
function onArrow(event: KeyboardEvent): void {
  const count = orderedOptions.value.length;
  if (enterOption.value === null || count === 0) return;
  event.preventDefault();
  const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
  if (vertical) {
    const buttons = [...(card.value?.$el.querySelectorAll<HTMLElement>('[data-option]') ?? [])];
    if (buttons.length === count) {
      const boxes = buttons.map((button) => button.getBoundingClientRect());
      selectedIndex.value = rowNeighbour(boxes, selectedIndex.value, forward);
    }
  } else {
    selectedIndex.value = (selectedIndex.value + (forward ? 1 : -1) + count) % count;
  }
  nextTick(() => {
    card.value?.$el.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
}

/** The box holds words or text, so the plain arrows move within it. */
const boxBusy = computed(() => tokens.value.length > 0 || filter.value !== '');

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/** Esc clears; the arrows move within the box, or with Alt (or an empty box) through the choices. */
function onBoxKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    clear();
    return;
  }
  if (!ARROWS.has(event.key) || event.shiftKey || event.ctrlKey || event.metaKey) return;
  if (event.altKey || !boxBusy.value) onArrow(event);
  else moveInBox(event);
}

/** Moves focus between the words and the text input; see boxMove. */
function moveInBox(event: KeyboardEvent): void {
  const words = [...(box.value?.querySelectorAll<HTMLElement>('[data-token]') ?? [])];
  const field = input.value;
  if (!field) return;
  const focused = words.indexOf(document.activeElement as HTMLElement);
  const at = focused === -1 ? words.length : focused;
  const caretAtStart = field.selectionStart === 0 && field.selectionEnd === 0;
  const move = boxMove(at, words.length, event.key, caretAtStart);
  if (!move) return;
  event.preventDefault();
  if (move.target < words.length) {
    words[move.target].focus();
    return;
  }
  field.focus();
  const position = move.caret === 'start' ? 0 : field.value.length;
  field.setSelectionRange(position, position);
}

/** The keys that do something right now, for the row under the builder. */
const hints = computed(() =>
  keyHints({
    boxBusy: boxBusy.value,
    enterRuns: complete.value && filter.value.trim() === '',
    canPick: enterOption.value !== null,
    canMove: enterOption.value !== null && orderedOptions.value.length > 1,
    altKey: isApple ? '⌥' : 'Alt'
  })
);

/**
 * One line that explains what you are looking at: the hovered option; while typing, the option
 * Enter would pick; else the chosen instruction, or before one is chosen, Enter's option.
 */
const preview = computed<{ label: string; text: string } | null>(() => {
  const described = props.grammar.describe(chosen.value);
  const typing = filter.value.trim() !== '';
  const option = hovered.value ?? (described === null || typing ? enterOption.value : null);
  if (option?.hint) return { label: option.label, text: option.hint };
  return described;
});

function focusInput(): void {
  nextTick(() => input.value?.focus());
}

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
  focusInput();
}

function back(): void {
  if (tokens.value.length > 0) truncateTo(tokens.value.length - 1);
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
  const selected = enterOption.value;
  if (selected) choose(selected);
}

function onBackspace(event: KeyboardEvent): void {
  if (filter.value === '') {
    event.preventDefault();
    back();
  }
}
</script>

<template>
  <Card
    ref="card"
    @focusin="active = true"
    @focusout="onFocusOut"
    @pointerdown="unfold"
    @keydown="onKeydown"
  >
    <CardHeader>
      <CardTitle>Instruction</CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <!-- The instruction so far, word by word, followed by the filter input. -->
      <div
        ref="box"
        data-loc="builder"
        class="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 font-mono text-sm transition-[border-color,outline-color] well outline-3 outline-transparent focus-within:border-pointer/70 focus-within:outline-pointer/20"
        @click="focusInput"
        @keydown="onBoxKeydown"
      >
        <Tooltip v-for="(token, index) in tokens" :key="index">
          <TooltipTrigger as-child>
            <button
              type="button"
              data-token
              class="inline-flex h-7 items-center rounded-md px-2 transition-colors hover:bg-destructive/10 hover:text-destructive hover:line-through focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              :class="[
                token.head
                  ? 'bg-foreground font-semibold text-background'
                  : 'bg-raised shadow-(--shadow-thumb)',
                token.pending
                  ? 'border border-dashed border-foreground/40 bg-transparent shadow-none'
                  : ''
              ]"
              @click.stop="truncateTo(index)"
            >
              {{ token.label }}
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove this word and the ones after it</TooltipContent>
        </Tooltip>
        <input
          ref="input"
          v-model="filter"
          class="h-7 min-w-40 flex-1 bg-transparent px-1 outline-none placeholder:font-sans placeholder:text-muted-foreground"
          :placeholder="moreToChoose ? hint : 'Ready to run'"
          :aria-invalid="doesNotFit || undefined"
          aria-label="Instruction"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          autocomplete="off"
          enterkeyhint="go"
          @keydown.enter.prevent="onEnter"
          @keydown.backspace="onBackspace"
        />
        <Tooltip v-if="tokens.length > 0">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground pointer-coarse:size-11"
              aria-label="Clear the instruction"
              aria-keyshortcuts="Escape"
              @click.stop="clear"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear the instruction <Kbd>Esc</Kbd></TooltipContent>
        </Tooltip>
      </div>

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
          v-if="moreToChoose && !choicesShown && twoColumns"
          type="button"
          class="flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-pointer outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
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

      <div
        v-if="moreToChoose && choicesShown"
        class="scroll-fade -mx-1 max-h-[min(21rem,40svh)] scroll-pb-7 overflow-y-auto px-1"
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
              class="font-mono"
              :data-selected="option === enterOption"
              data-option
              :class="
                option === enterOption
                  ? 'border-foreground/70 bg-muted text-foreground dark:border-foreground/60 dark:bg-muted'
                  : ''
              "
              @click="choose(option)"
              @mouseenter="hovered = option"
              @mouseleave="hovered = null"
              @focus="hovered = option"
              @blur="hovered = null"
            >
              {{ option.label }}
              <CornerDownLeft
                v-if="option === enterOption"
                class="text-foreground"
                aria-label="Enter picks this"
              />
            </Button>
          </div>
        </div>
        <!-- A number that is too big already has its own message above. -->
        <p v-if="groups.length === 0 && !doesNotFit" class="text-sm text-muted-foreground">
          <template v-if="filter.trim()">
            Nothing matches “<span class="font-mono break-all text-foreground">{{ filter }}</span
            >”. Press <Kbd>Backspace</Kbd> to edit it or <Kbd>Esc</Kbd> to start over.
          </template>
          <template v-else>{{ hint }}</template>
        </p>
      </div>
      <div v-else-if="!moreToChoose" class="text-sm text-muted-foreground">
        <p>
          Complete. Run it now, or add it to the program at line
          <span class="font-mono text-foreground">{{ formatLabel(insertLine) }}</span>.
        </p>
      </div>
    </CardContent>

    <!-- In a narrow pane the buttons take a row of their own rather than being cut off. -->
    <CardFooter class="flex-wrap justify-between gap-x-3 gap-y-2">
      <!-- The keys that do something right now; see builderKeys.ts. -->
      <div class="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
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
          class="quiet-disabled disabled:opacity-100"
          :disabled="!complete"
          @click="submit(true)"
        >
          <Plus />
          Add at {{ formatLabel(insertLine) }}
        </Button>
        <Button
          size="sm"
          class="quiet-disabled px-3 hover:bg-primary/85 disabled:opacity-100"
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
