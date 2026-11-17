<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { hasMoreOperands, operandChoices } from '@/core/builder';
import {
  CATEGORY_LABELS,
  INSTRUCTIONS,
  MNEMONICS,
  REPEAT_PREFIXES,
  isComplete,
  prefixAllows,
  type Category,
  type Instruction,
  type Mnemonic,
  type RepeatPrefix
} from '@/core/instructions';
import { fitsIn, formatHex, parseNumber, type Size } from '@/core/numbers';
import {
  MEMORY_BASES,
  formatImmediate,
  formatLabel,
  formatOperand,
  memorySegment,
  type MemoryBase,
  type Operand
} from '@/core/operands';
import { isByteRegister, isSegmentRegister } from '@/core/registers';
import { CircleAlert, CornerDownLeft, Play, Plus, X } from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

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

type MemoryOperand = Extract<Operand, { type: 'mem' }>;

interface Option {
  key: string;
  label: string;
  group: string;
  hint?: string;
  /** For options a typed number can select: immediates, direct addresses, the count 1, labels. */
  matchesNumber?: (value: number) => boolean;
  apply: () => void;
}

const anyNumber = () => true;

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
/** True while focus is inside the builder: the choices fold away when it is not in use. */
const active = ref(false);

function onFocusOut(): void {
  // Focus moves between the input and the choices; only leaving the card counts.
  setTimeout(() => {
    active.value = card.value?.$el.contains(document.activeElement) ?? false;
  });
}
/** The option under the pointer or keyboard focus; its hint is previewed below the input. */
const hovered = ref<Option | null>(null);

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

function memoryOperand(base: MemoryBase | null, displacement: number): MemoryOperand {
  return { type: 'mem', size: pendingMemory.value ?? 16, base, displacement };
}

function mnemonicOptions(): Option[] {
  const chosen = prefix.value;
  const options: Option[] = [];
  let prefixesOffered = chosen !== null;
  const offerPrefixes = (): void => {
    prefixesOffered = true;
    for (const name of Object.keys(REPEAT_PREFIXES) as RepeatPrefix[]) {
      options.push({
        key: `prefix-${name}`,
        label: name,
        group: 'Repeat prefix',
        hint: `${REPEAT_PREFIXES[name]}. Pick the string instruction next.`,
        apply: () => {
          prefix.value = name;
        }
      });
    }
  };

  for (const name of MNEMONICS) {
    const category = INSTRUCTIONS[name].category as Category;
    // The prefixes sit right after the string instructions they repeat.
    if (
      !prefixesOffered &&
      options.at(-1)?.group === CATEGORY_LABELS.string &&
      category !== 'string'
    ) {
      offerPrefixes();
    }
    if (chosen && !prefixAllows(chosen, name)) continue;
    options.push({
      key: name,
      label: name,
      group: CATEGORY_LABELS[category],
      hint: INSTRUCTIONS[name].description,
      apply: () => {
        mnemonic.value = name;
      }
    });
  }
  return options;
}

function memoryAddressOptions(): Option[] {
  const options: Option[] = MEMORY_BASES.map((base) => {
    const operand = memoryOperand(base, 0);
    return {
      key: `base-${base}`,
      label: `[${base}]`,
      group: 'Address in a register',
      hint: `${memorySegment(operand).toUpperCase()}:${base.toUpperCase()}`,
      apply: () => addOperand(operand)
    };
  });

  const address = typedNumber.value;
  if (address !== null && address >= 0 && address <= 0xffff) {
    options.unshift({
      key: 'direct',
      label: `[0x${formatHex(address, 16)}]`,
      group: 'Direct address',
      hint: 'DS:offset',
      matchesNumber: anyNumber,
      apply: () => addOperand(memoryOperand(null, address))
    });
  }
  return options;
}

function operandOptions(current: Mnemonic): Option[] {
  const choices = operandChoices(current, operands.value);
  const options: Option[] = [];

  const number = typedNumber.value;
  if (choices.immediate !== null && number !== null) {
    const size = choices.immediate;
    if (fitsIn(number, size)) {
      options.push({
        key: 'imm',
        label: formatImmediate(number),
        group: `Immediate (${size}-bit)`,
        hint: number < 0 ? `= 0x${formatHex(number, size)}` : `= ${number}`,
        matchesNumber: anyNumber,
        apply: () => addOperand({ type: 'imm', value: number })
      });
    }
  }
  if (choices.one) {
    options.push({
      key: 'one',
      label: '1',
      group: 'Count',
      matchesNumber: (value) => value === 1,
      apply: () => addOperand({ type: 'imm', value: 1 })
    });
  }

  if (choices.label) {
    // Every line is a target, plus the line after the last one (the end of the program).
    for (let target = 0; target <= props.programLines.length; target++) {
      options.push({
        key: `label${target}`,
        label: formatLabel(target),
        group:
          INSTRUCTIONS[current].category === 'control'
            ? 'Jump to program line'
            : 'Number of a program line',
        hint: props.programLines[target] ?? 'end of program',
        matchesNumber: (value) => value === target,
        apply: () => addOperand({ type: 'label', target })
      });
    }
  }

  for (const name of choices.registers) {
    const group = isByteRegister(name)
      ? '8-bit registers'
      : isSegmentRegister(name)
        ? 'Segment registers'
        : '16-bit registers';
    options.push({ key: name, label: name, group, apply: () => addOperand({ type: 'reg', name }) });
  }

  for (const size of choices.memory) {
    const label = size === 8 ? 'byte [ ]' : 'word [ ]';
    options.push({
      key: `mem${size}`,
      label,
      group: 'Memory',
      hint: `${size}-bit value in memory`,
      apply: () => {
        pendingMemory.value = size;
      }
    });
  }

  return options;
}

const allOptions = computed<Option[]>(() => {
  if (mnemonic.value === null) return mnemonicOptions();
  if (pendingMemory.value !== null) return memoryAddressOptions();
  return operandOptions(mnemonic.value);
});

const visibleOptions = computed(() => {
  const text = filter.value.trim().toLowerCase();
  if (!text) return allOptions.value;
  // A typed number only selects the options that accept that number.
  const number = typedNumber.value;
  if (number !== null) {
    return allOptions.value.filter((option) => option.matchesNumber?.(number));
  }
  // Matches that start with the typed text come first, so Enter picks the obvious one.
  const matches = allOptions.value.filter((option) => option.label.toLowerCase().includes(text));
  return [
    ...matches.filter((option) => option.label.toLowerCase().startsWith(text)),
    ...matches.filter((option) => !option.label.toLowerCase().startsWith(text))
  ];
});

const groups = computed(() => {
  const map = new Map<string, Option[]>();
  for (const option of visibleOptions.value) {
    map.set(option.group, [...(map.get(option.group) ?? []), option]);
  }
  return [...map.entries()];
});

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
    return `Type a number for an immediate (42, 0x2A, 2Ah, 101010b)`;
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

/** The option Enter would pick. */
const enterOption = computed(() =>
  complete.value && !filter.value.trim() ? null : (visibleOptions.value[0] ?? null)
);

/**
 * One line that explains what you are looking at: the hovered option, else the chosen
 * instruction, else the option Enter would pick.
 */
const preview = computed<{ label: string; text: string } | null>(() => {
  const option = hovered.value ?? (mnemonic.value === null ? enterOption.value : null);
  if (option?.hint) return { label: option.label, text: option.hint };
  if (mnemonic.value)
    return { label: mnemonic.value, text: INSTRUCTIONS[mnemonic.value].description };
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

onMounted(focusInput);

function choose(option: Option): void {
  option.apply();
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
  const first = visibleOptions.value[0];
  if (first) choose(first);
}

function onBackspace(event: KeyboardEvent): void {
  if (filter.value === '') {
    event.preventDefault();
    back();
  }
}
</script>

<template>
  <Card ref="card" @focusin="active = true" @focusout="onFocusOut">
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
        <button
          v-for="(token, index) in tokens"
          :key="index"
          type="button"
          class="inline-flex h-7 items-center rounded-md px-2 transition-colors hover:bg-destructive/10 hover:text-destructive hover:line-through focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          :class="[
            token.head ? 'bg-foreground font-semibold text-background' : 'bg-secondary',
            token.pending ? 'border border-dashed border-foreground/40 bg-transparent' : ''
          ]"
          title="Remove this word and the ones after it"
          @click.stop="truncateTo(index)"
        >
          {{ token.label }}
        </button>
        <input
          ref="input"
          v-model="filter"
          class="h-7 min-w-40 flex-1 bg-transparent px-1 outline-none placeholder:font-sans placeholder:text-muted-foreground"
          :placeholder="moreToChoose ? typingHint : 'Ready to run'"
          :aria-invalid="doesNotFit || undefined"
          aria-label="Instruction"
          spellcheck="false"
          autocomplete="off"
          autofocus
          @keydown.enter.prevent="onEnter"
          @keydown.backspace="onBackspace"
          @keydown.esc="clear"
        />
        <Button
          v-if="tokens.length > 0"
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground"
          title="Clear (Esc)"
          aria-label="Clear the instruction"
          @click.stop="clear"
        >
          <X />
        </Button>
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

      <div v-if="moreToChoose && active" class="-mx-1 max-h-72 overflow-y-auto px-1 lg:max-h-80">
        <div v-for="[group, options] in groups" :key="group" class="mb-3 last:mb-0">
          <h3 class="mb-1.5 text-xs text-muted-foreground">{{ group }}</h3>
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="option in options"
              :key="option.key"
              variant="outline"
              size="sm"
              class="font-mono"
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
        <p v-if="groups.length === 0" class="text-sm text-muted-foreground">{{ typingHint }}</p>
      </div>
      <div v-else-if="!moreToChoose" class="text-sm text-muted-foreground">
        <p>
          Complete. Run it now, or add it to the program at line
          <span class="font-mono text-foreground">{{ formatLabel(insertLine) }}</span>.
        </p>
      </div>
    </CardContent>

    <CardFooter class="justify-between gap-3">
      <div class="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
        <span class="flex items-center gap-1.5"><Kbd>Enter</Kbd> run</span>
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
