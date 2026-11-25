<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { X } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DraftToken } from '@/ui/builderGrammar';
import { useBoxArrows } from '@/ui/useBuilderArrows';

/** The instruction so far, word by word, followed by the text input that filters the choices. */
const props = defineProps<{
  tokens: DraftToken[];
  placeholder: string;
  /** The typed number does not fit where it would go. */
  invalid: boolean;
}>();

const filter = defineModel<string>('filter', { required: true });

const emit = defineEmits<{
  /** Remove the word at `index` and the ones after it. */
  truncate: [index: number];
  clear: [];
  enter: [event: KeyboardEvent];
  /** Backspace in an empty input: take back the last word. */
  back: [];
  /** An arrow key meant for the choices below, not for the box. */
  optionArrow: [event: KeyboardEvent];
}>();

const box = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const moveInBox = useBoxArrows(box, input);

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/** Esc clears; the arrows move within the box, or with Alt (or an empty box) through the choices. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    // Esc that cleared something is used up; on an empty box it is left to the page (a tablet's
    // drawer closes on it).
    if (props.tokens.length > 0 || filter.value !== '') event.preventDefault();
    emit('clear');
    return;
  }
  if (!ARROWS.has(event.key) || event.shiftKey || event.ctrlKey || event.metaKey) return;
  const busy = props.tokens.length > 0 || filter.value !== '';
  if (event.altKey || !busy) emit('optionArrow', event);
  else moveInBox(event);
}

function onBackspace(event: KeyboardEvent): void {
  if (filter.value !== '') return;
  event.preventDefault();
  emit('back');
}

/**
 * True from a focus nobody asked for (the page just loaded) until the learner does something:
 * the caret is in the box, but the ring waits, so a fresh page does not open on a blue outline.
 */
const quiet = ref(false);

function focus(options: { quiet?: boolean } = {}): void {
  quiet.value = options.quiet === true;
  void nextTick(() => input.value?.focus());
}

defineExpose({ focus });
</script>

<template>
  <div
    ref="box"
    data-loc="builder"
    class="flex min-h-11 shrink-0 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 font-mono text-sm transition-[border-color,outline-color] well outline-3 outline-transparent"
    :class="
      quiet
        ? 'focus-within:border-foreground/50'
        : 'focus-within:border-ring focus-within:outline-ring/20'
    "
    @click="focus()"
    @keydown.capture="quiet = false"
    @keydown="onKeydown"
    @focusout="quiet = false"
  >
    <template v-for="(token, index) in tokens" :key="index">
      <!-- Between two operands, the comma the instruction is written with everywhere else. -->
      <span
        v-if="index > 0 && !token.head && !tokens[index - 1].head"
        class="-mx-1 text-muted-foreground select-none"
        aria-hidden="true"
        >,</span
      >
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            data-token
            class="inline-flex h-7 items-center rounded-md px-2 transition-colors pointer-coarse:h-9 hover:bg-destructive/10 hover:text-destructive hover:line-through focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            :class="[
              token.head
                ? 'bg-foreground font-semibold text-background'
                : 'bg-raised shadow-(--shadow-thumb)',
              token.pending
                ? 'border border-dashed border-foreground/40 bg-transparent shadow-none'
                : ''
            ]"
            :aria-label="`Remove ${token.label}${index < tokens.length - 1 ? ' and the words after it' : ''}`"
            @click.stop="emit('truncate', index)"
          >
            {{ token.label }}
          </button>
        </TooltipTrigger>
        <TooltipContent>Remove this word and the ones after it</TooltipContent>
      </Tooltip>
    </template>
    <input
      ref="input"
      v-model="filter"
      class="h-7 min-w-40 flex-1 bg-transparent px-1 outline-none pointer-coarse:h-9 placeholder:font-sans placeholder:text-muted-foreground"
      :placeholder="placeholder"
      :aria-invalid="invalid || undefined"
      aria-label="Instruction"
      type="text"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      autocomplete="off"
      enterkeyhint="go"
      @keydown.enter.prevent="emit('enter', $event)"
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
          @click.stop="emit('clear')"
        >
          <X />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Clear the instruction <Kbd>Esc</Kbd></TooltipContent>
    </Tooltip>
  </div>
</template>
