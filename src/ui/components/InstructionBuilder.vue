<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { hasMoreOperands, operandChoices } from '@/core/builder';
import {
  getSpec,
  isComplete,
  type Instruction,
  type Mnemonic,
  type RepeatPrefix
} from '@/core/instructions';
import { fitsIn, parseNumber, type Size } from '@/core/numbers';
import { formatLabel, formatOperand, type Operand } from '@/core/operands';
import { CircleAlert, CornerDownLeft, Play, Plus, X } from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  builderOptions,
  filterOptions,
  type BuilderOption,
  type OptionAction
} from '@/ui/builderOptions';
import { groupBy } from '@/ui/groupBy';

const props = defineProps<{
  /** Runs the instruction; returns false when the CPU rejected it. */
  run: (instruction: Instruction) => boolean;
  /** Adds the instruction to the program at `insertLine`. */
  add: (instruction: Instruction) => void;
  error: string | null;
  /** The program, formatted, so jumps can offer its lines as targets. */
  programLines: string[];
  insertLine: number;
}>();

const emit = defineEmits<{
  /** The instruction as built so far, once it is complete; null while it is not. */
  draft: [instruction: Instruction | null];
}>();

const READY_HINT = 'Enter: run now · Shift+Enter: add to the program';

/** A repeat prefix chosen before the mnemonic; it narrows the mnemonics to the ones it fits. */
const prefix = ref<RepeatPrefix | null>(null);
const mnemonic = ref<Mnemonic | null>(null);
const operands = ref<Operand[]>([]);
/** Set after choosing "byte [ ]" / "word [ ]", until the address inside the brackets is chosen. */
const pendingMemory = ref<Size | null>(null);
const filter = ref('');
const input = ref<HTMLInputElement | null>(null);
const card = ref<{ $el: HTMLElement } | null>(null);
/** True while focus is inside the builder. */
const active = ref(false);
/**
 * With two columns the choices do not follow focus: folding them away would move every panel
 * below the builder each time focus came and went, under a pointer that is about to click. In
 * one column they fold away when the builder is not in use, so the CPU panels are not pushed
 * off screen.
 */
const twoColumns = useMediaQuery('(min-width: 64rem)');
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
const hovered = ref<BuilderOption | null>(null);

const complete = computed(
  () =>
    mnemonic.value !== null &&
    pendingMemory.value === null &&
    isComplete(mnemonic.value, operands.value)
);

const typedNumber = computed(() => parseNumber(filter.value));

function addOperand(operand: Operand): void {
  operands.value = [...operands.value, operand];
  pendingMemory.value = null;
}

const allOptions = computed(() =>
  builderOptions({
    prefix: prefix.value,
    mnemonic: mnemonic.value,
    operands: operands.value,
    pendingMemory: pendingMemory.value,
    typed: typedNumber.value,
    programLines: props.programLines
  })
);

const visibleOptions = computed(() =>
  filterOptions(allOptions.value, filter.value, typedNumber.value)
);

const groups = computed(() => groupBy(visibleOptions.value, (option) => option.group));

/** The immediate size the typed number is too big for, or null when it fits or none is asked. */
const overflowSize = computed<Size | null>(() => {
  if (mnemonic.value === null || pendingMemory.value !== null) return null;
  const size = operandChoices(mnemonic.value, operands.value).immediate;
  const number = typedNumber.value;
  return size !== null && number !== null && !fitsIn(number, size) ? size : null;
});

const doesNotFit = computed(() => overflowSize.value !== null);

/** Hint for values that are typed rather than picked. */
const typingHint = computed(() => {
  if (mnemonic.value === null) {
    return prefix.value ? 'Pick the string instruction to repeat' : 'Type to filter instructions';
  }
  if (pendingMemory.value !== null) return 'Pick a register or type an offset (e.g. 0x10)';
  if (overflowSize.value !== null) {
    return `${filter.value} does not fit in ${overflowSize.value} bits`;
  }
  const choices = operandChoices(mnemonic.value, operands.value);
  if (choices.immediate !== null) {
    return 'Type a number: 42 (decimal), 0x2A or 2Ah (hex), 101010b (binary)';
  }
  if (choices.label) return 'Pick a line to jump to, or type its number';
  if (complete.value) return READY_HINT;
  return 'Type to filter';
});

const moreToChoose = computed(
  () =>
    mnemonic.value === null ||
    pendingMemory.value !== null ||
    hasMoreOperands(mnemonic.value, operands.value)
);

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

/** The index of the button on the next row up or down, in the column nearest to `from`. */
function rowNeighbour(buttons: HTMLElement[], from: number, down: boolean): number {
  const current = buttons[from].getBoundingClientRect();
  const centre = current.left + current.width / 2;
  let rowTop: number | null = null;
  for (const button of buttons) {
    const top = button.getBoundingClientRect().top;
    const beyond = down ? top > current.top + 1 : top < current.top - 1;
    if (beyond && (rowTop === null || (down ? top < rowTop : top > rowTop))) rowTop = top;
  }
  if (rowTop === null) return from;
  let best = from;
  let distance = Infinity;
  buttons.forEach((button, index) => {
    const rect = button.getBoundingClientRect();
    if (Math.abs(rect.top - rowTop) > 1) return;
    const gap = Math.abs(rect.left + rect.width / 2 - centre);
    if (gap < distance) {
      distance = gap;
      best = index;
    }
  });
  return best;
}

/**
 * Arrows walk the options: Left/Right one at a time, Up/Down by row. While there is text to
 * edit, the plain arrows stay with the input and only Alt+arrow navigates.
 */
function onArrow(event: KeyboardEvent): void {
  const count = orderedOptions.value.length;
  if (enterOption.value === null || count === 0) return;
  if (filter.value !== '' && !event.altKey) return;
  event.preventDefault();
  const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
  if (vertical) {
    const buttons = [...(card.value?.$el.querySelectorAll<HTMLElement>('[data-option]') ?? [])];
    if (buttons.length === count) {
      selectedIndex.value = rowNeighbour(buttons, selectedIndex.value, forward);
    }
  } else {
    selectedIndex.value = (selectedIndex.value + (forward ? 1 : -1) + count) % count;
  }
  nextTick(() => {
    card.value?.$el.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
}

/**
 * One line that explains what you are looking at: the hovered option, else the chosen
 * instruction, else the option Enter would pick.
 */
const preview = computed<{ label: string; text: string } | null>(() => {
  const option = hovered.value ?? (mnemonic.value === null ? enterOption.value : null);
  if (option?.hint) return { label: option.label, text: option.hint };
  if (mnemonic.value) return { label: mnemonic.value, text: getSpec(mnemonic.value).description };
  return null;
});

const tokens = computed(() => {
  const list: { label: string; pending?: boolean; head?: boolean }[] = [];
  if (prefix.value) list.push({ label: prefix.value, head: true });
  if (mnemonic.value) list.push({ label: mnemonic.value, head: true });
  operands.value.forEach((operand) => list.push({ label: formatOperand(operand) }));
  if (pendingMemory.value !== null) {
    list.push({ label: `${pendingMemory.value === 8 ? 'byte' : 'word'} [ ? ]`, pending: true });
  }
  return list;
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

function apply(action: OptionAction): void {
  switch (action.kind) {
    case 'prefix':
      prefix.value = action.prefix;
      return;
    case 'mnemonic':
      mnemonic.value = action.mnemonic;
      return;
    case 'operand':
      addOperand(action.operand);
      return;
    case 'memory':
      pendingMemory.value = action.size;
      return;
  }
}

function choose(option: BuilderOption): void {
  apply(option.action);
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
  pendingMemory.value = null;
  if (prefix.value && index === 1) {
    mnemonic.value = null;
    operands.value = [];
  } else {
    operands.value = operands.value.slice(0, index - (prefix.value ? 2 : 1));
  }
  focusInput();
}

function back(): void {
  if (tokens.value.length > 0) truncateTo(tokens.value.length - 1);
}

function clear(): void {
  prefix.value = null;
  mnemonic.value = null;
  operands.value = [];
  pendingMemory.value = null;
  filter.value = '';
  focusInput();
}

const built = computed<Instruction | null>(() => {
  if (!complete.value || mnemonic.value === null) return null;
  const instruction: Instruction = { mnemonic: mnemonic.value, operands: operands.value };
  if (prefix.value) instruction.prefix = prefix.value;
  return instruction;
});

watch(built, (instruction) => emit('draft', instruction));

/** Runs the instruction now, or adds it to the program. */
function submit(toProgram: boolean): void {
  const instruction = built.value;
  if (!instruction) return;
  if (toProgram) {
    props.add(instruction);
    clear();
  } else if (props.run(instruction)) {
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
        data-loc="builder"
        class="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
        @click="focusInput"
      >
        <Tooltip v-for="(token, index) in tokens" :key="index">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex h-7 items-center rounded-md px-2 transition-colors hover:bg-destructive/10 hover:text-destructive hover:line-through focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              :class="[
                token.head ? 'bg-foreground font-semibold text-background' : 'bg-secondary',
                token.pending ? 'border border-dashed border-foreground/40 bg-transparent' : ''
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
          :placeholder="moreToChoose ? typingHint : 'Ready to run'"
          :aria-invalid="doesNotFit || undefined"
          aria-label="Instruction"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          autocomplete="off"
          enterkeyhint="go"
          @keydown.enter.prevent="onEnter"
          @keydown.down="onArrow"
          @keydown.right="onArrow"
          @keydown.up="onArrow"
          @keydown.left="onArrow"
          @keydown.backspace="onBackspace"
          @keydown.esc="clear"
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

      <p class="min-h-5 truncate text-sm text-muted-foreground" aria-live="polite">
        <template v-if="doesNotFit">
          <span class="text-destructive">{{ typingHint }}</span>
        </template>
        <template v-else-if="preview">
          <span class="mr-2 font-mono font-medium text-foreground">{{ preview.label }}</span>
          {{ preview.text }}
        </template>
      </p>

      <Alert v-if="error" variant="destructive" role="alert">
        <CircleAlert />
        <AlertDescription class="text-destructive/90">{{ error }}</AlertDescription>
      </Alert>

      <div
        v-if="moreToChoose && choicesShown"
        class="-mx-1 max-h-72 overflow-y-auto px-1 lg:max-h-80"
      >
        <div v-for="[group, options] in groups" :key="group" class="mb-3 last:mb-0">
          <h3 class="mb-1.5 text-xs text-muted-foreground">{{ group }}</h3>
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
                  ? 'border-foreground/50 bg-secondary dark:border-foreground/40'
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
                class="text-muted-foreground"
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
          <template v-else>{{ typingHint }}</template>
        </p>
      </div>
      <!-- Takes the place of the choices, so the program below stays where the fold left it. -->
      <button
        v-else-if="moreToChoose && twoColumns"
        type="button"
        class="self-start rounded-sm text-sm text-muted-foreground underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        @click="unfold"
      >
        Show the choices
      </button>
      <div v-else-if="!moreToChoose" class="text-sm text-muted-foreground">
        <p>
          Complete. Run it now, or add it to the program at line
          <span class="font-mono text-foreground">{{ formatLabel(insertLine) }}</span>.
        </p>
      </div>
    </CardContent>

    <CardFooter class="justify-between gap-3">
      <div class="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
        <span class="flex items-center gap-1.5"><Kbd>Enter</Kbd> run now</span>
        <span class="flex items-center gap-1.5">
          <KbdGroup><Kbd>⇧</Kbd><Kbd>Enter</Kbd></KbdGroup> add
        </span>
        <span class="flex items-center gap-1.5"><Kbd>Esc</Kbd> clear</span>
      </div>
      <div class="ml-auto flex gap-2">
        <Button variant="outline" size="sm" :disabled="!complete" @click="submit(true)">
          <Plus />
          Add at {{ formatLabel(insertLine) }}
        </Button>
        <Button size="sm" :disabled="!complete" @click="submit(false)">
          <Play />
          Run now
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>
