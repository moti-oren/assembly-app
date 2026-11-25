<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseWord, readingText } from '@/ui/controlView';
import { hexOf } from '@/ui/logicView';
import type { ControlLens } from '@/ui/useControlLens';

const props = defineProps<{ lens: ControlLens }>();

const hintId = useId();
const typed = ref('');
/** Shown only once a word that cannot be read was sent. */
const refused = ref(false);

// The box always holds the word on show, so a flipped bit is seen in hex too.
watch(
  () => props.lens.word.value,
  (word) => {
    typed.value = hexOf(word, 32);
    refused.value = false;
  },
  { immediate: true }
);

// The CPU's own word is already written as its program wrote it: a second spelling of the same
// instruction only says it again.
const reading = computed(() =>
  props.lens.fromCpu.value && !props.lens.isEdited.value
    ? null
    : readingText(props.lens.word.value, props.lens.solution.value)
);

/** The whole word is picked as the box takes the focus, so typing replaces it. */
function selectAll(event: FocusEvent): void {
  if (event.target instanceof HTMLInputElement) event.target.select();
}

function send(): void {
  const word = parseWord(typed.value);
  refused.value = word === null;
  if (word !== null) props.lens.setWord(word);
}
</script>

<!-- The word in hex, to type another one, and what it reads as in assembly. -->
<template>
  <div class="flex flex-col gap-1.5">
    <form class="flex flex-wrap items-center gap-1.5" @submit.prevent="send">
      <Input
        v-model="typed"
        class="h-8 w-36 font-mono pointer-coarse:h-11"
        aria-label="The instruction word in hex"
        :aria-invalid="refused || undefined"
        :aria-describedby="hintId"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        data-control-word
        @input="refused = false"
        @focus="selectAll"
      />
      <Button type="submit" size="sm" variant="outline" class="pointer-coarse:h-11">
        Decode
      </Button>
    </form>
    <div :id="hintId" class="max-w-prose text-sm text-pretty">
      <p v-if="!refused && reading">{{ reading }}</p>
      <!-- Only a refusal is announced: the reading changes with every bit that is flipped. -->
      <p aria-live="polite">
        <span v-if="refused">Type up to eight hex digits, such as 0x40B50533.</span>
      </p>
    </div>
  </div>
</template>
