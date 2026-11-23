<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { digitsOf, parseAnswer, type Answer, type Question } from '@/ui/prediction';

const props = defineProps<{ question: Question }>();
const emit = defineEmits<{ answer: [answer: Answer] }>();

// Every workbench stays mounted, so the hint's id must be its own.
const hintId = useId();
const typed = ref('');
/** Shown only once an answer that cannot be read was sent. */
const refused = ref(false);
const flagsOn = ref<string[]>([]);

const digits = computed(() => (props.question.kind === 'value' ? digitsOf(props.question) : 0));

function flip(flag: string): void {
  flagsOn.value = flagsOn.value.includes(flag)
    ? flagsOn.value.filter((other) => other !== flag)
    : [...flagsOn.value, flag];
}

function check(): void {
  if (props.question.kind === 'flags') {
    emit('answer', { kind: 'flags', on: flagsOn.value });
    return;
  }
  if (props.question.kind !== 'value') return;
  const value = parseAnswer(typed.value, props.question.bits);
  refused.value = value === null;
  if (value !== null) emit('answer', { kind: 'value', value });
}
</script>

<!-- The control a question is answered with: two buttons, a hex box, or a switch per flag. -->
<template>
  <div v-if="question.kind === 'branch'" class="flex gap-1.5" role="group" aria-label="Your answer">
    <Button
      size="sm"
      variant="outline"
      class="pointer-coarse:h-11"
      @click="emit('answer', { kind: 'branch', taken: true })"
    >
      It jumps
    </Button>
    <Button
      size="sm"
      variant="outline"
      class="pointer-coarse:h-11"
      @click="emit('answer', { kind: 'branch', taken: false })"
    >
      It falls through
    </Button>
  </div>

  <form v-else class="flex flex-wrap items-center gap-1.5" @submit.prevent="check">
    <template v-if="question.kind === 'value'">
      <Input
        v-model="typed"
        class="h-8 w-32 font-mono pointer-coarse:h-11"
        :maxlength="digits + 3"
        placeholder="hex"
        :aria-label="`${question.register} in hex`"
        :aria-invalid="refused || undefined"
        :aria-describedby="hintId"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        @input="refused = false"
      />
    </template>
    <div v-else class="toggle-group" role="group" aria-label="Flags that will be 1">
      <Button
        v-for="flag in question.flags"
        :key="flag"
        type="button"
        size="sm"
        variant="ghost"
        class="border border-input font-mono tabular-nums aria-pressed:border-foreground/40 aria-pressed:font-bold pointer-coarse:h-11"
        :aria-pressed="flagsOn.includes(flag)"
        @click="flip(flag)"
      >
        {{ flag }} {{ flagsOn.includes(flag) ? 1 : 0 }}
      </Button>
    </div>
    <Button type="submit" size="sm" class="pointer-coarse:h-11">Check</Button>
    <!-- Under the box and its button, so it never pushes Check onto a line of its own. -->
    <p
      v-if="question.kind === 'value'"
      :id="hintId"
      role="alert"
      class="text-xs text-destructive"
      :class="refused ? 'basis-full' : 'sr-only'"
    >
      {{ refused ? `Hex, up to ${digits} digits: 0–9 and A–F.` : '' }}
    </p>
  </form>
</template>
