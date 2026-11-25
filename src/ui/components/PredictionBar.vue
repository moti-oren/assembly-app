<script setup lang="ts">
import { useId, useTemplateRef } from 'vue';
import { Check, X } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { promptOf, tallyText, verdict, type Answer, type Tally } from '@/ui/prediction';
import type { Asking } from '@/ui/usePrediction';
import { usePredictionFocus } from '@/ui/usePredictionFocus';
import type { Answered } from '@/ui/usePredictionScore';
import PredictionAnswer from './PredictionAnswer.vue';

const props = defineProps<{
  /** The question waiting for an answer, if one is. */
  asking: Asking | null;
  /** The last answer, until another instruction runs. */
  last: Answered | null;
  /** The last question was skipped, and its instruction ran. */
  skipped: boolean;
  tally: Tally;
}>();

const emit = defineEmits<{
  answer: [answer: Answer];
  /** Runs the instruction without an answer. */
  skip: [];
}>();

const bar = useTemplateRef<HTMLElement>('bar');
const questionId = useId();
usePredictionFocus(bar, () => props.asking);
</script>

<!--
  Prediction mode's place on the page: the question before a step, then how the answer did.
  It stays mounted while it has nothing to show, so the verdict is announced when it arrives.
-->
<template>
  <section
    ref="bar"
    class="prediction-bar"
    :class="
      asking || last || skipped
        ? 'flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-t bg-card px-4 py-2 text-sm'
        : 'sr-only'
    "
    role="group"
    :aria-labelledby="asking ? questionId : undefined"
    :aria-label="asking ? undefined : 'Guess before it runs'"
    @keydown.esc.stop="asking && emit('skip')"
  >
    <template v-if="asking">
      <p :id="questionId" class="min-w-0">
        <code class="font-mono font-semibold">{{ asking.question.text }}</code>
        <span class="ml-2">{{ promptOf(asking.question) }}</span>
      </p>
      <!-- The answer and Skip share a row, under the question where the bar is narrow. -->
      <div class="flex flex-1 items-start gap-1.5 max-md:basis-full">
        <!-- A new question starts with nothing answered. -->
        <PredictionAnswer
          :key="`${asking.question.text} ${tally.asked}`"
          :question="asking.question"
          @answer="emit('answer', $event)"
        />
        <Button
          size="sm"
          variant="ghost"
          class="ml-auto text-muted-foreground pointer-coarse:h-11"
          @click="emit('skip')"
        >
          Skip
        </Button>
      </div>
    </template>
    <p
      class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2"
      :class="{ 'sr-only': asking }"
      role="status"
    >
      <template v-if="!asking && last">
        <component
          :is="last.outcome.correct ? Check : X"
          class="size-4 shrink-0 self-center"
          aria-hidden="true"
        />
        <span class="font-medium">{{ verdict(last.outcome) }}</span>
        <span v-if="last.outcome.why" class="text-muted-foreground">{{ last.outcome.why }}</span>
        <span class="text-xs text-muted-foreground tabular-nums max-md:basis-full md:ml-auto">
          {{ tallyText(tally) }}
        </span>
      </template>
      <!-- A skip is counted nowhere, but the tally so far stays in sight. -->
      <template v-else-if="!asking && skipped">
        <span class="font-medium">Skipped</span>
        <span
          v-if="tally.asked > 0"
          class="text-xs text-muted-foreground tabular-nums max-md:basis-full md:ml-auto"
        >
          {{ tallyText(tally) }}
        </span>
      </template>
    </p>
  </section>
</template>
