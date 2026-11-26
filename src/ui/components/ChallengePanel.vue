<script setup lang="ts">
import { computed } from 'vue';
import { Check, Circle } from '@lucide/vue';
import type { ChallengeResult } from '@/core/shared/challenge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { givenNote, isNews, outcomeText, solvedSaid, type ChallengeInfo } from '@/ui/challengeView';

const props = defineProps<{
  challenge: ChallengeInfo;
  result: ChallengeResult;
  /** How many lines the program starts with. */
  given: number;
  /** The challenge to go on to, once this one is solved; null when there is none. */
  next?: { title: string } | null;
}>();

const hintShown = defineModel<boolean>('hintShown', { required: true });

const emit = defineEmits<{
  restart: [];
  /** Opens the list of challenges. */
  list: [];
  /** Starts the next challenge. */
  next: [];
}>();

const verdicts = computed(() => [...props.result.goals, ...props.result.limits]);
const note = computed(() => givenNote(props.given, props.result.limits.length > 0));
const outcome = computed(() => outcomeText(props.result, props.challenge.par));
/** Only a result is announced: the running count would speak after every edit. */
const news = computed(() => isNews(props.result));
</script>

<!-- The challenge the program is for: the task, and what the program meets of it so far. -->
<template>
  <Card size="sm" data-challenge-panel tabindex="-1" class="outline-none">
    <CardHeader>
      <CardTitle role="heading" aria-level="2" class="group-data-[size=sm]/card:text-base"
        >Challenge</CardTitle
      >
      <CardDescription>{{ challenge.title }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-2.5 text-sm">
      <div>
        <p class="leading-relaxed text-pretty">{{ challenge.brief }}</p>
        <p v-if="note" class="mt-1 text-xs text-muted-foreground">{{ note }}</p>
      </div>

      <ul class="flex flex-col gap-1" aria-label="What the program must do">
        <li
          v-for="verdict in verdicts"
          :key="verdict.label"
          class="flex items-start gap-2"
          :class="verdict.met ? 'text-foreground' : 'text-muted-foreground'"
        >
          <component
            :is="verdict.met ? Check : Circle"
            class="mt-0.5 size-4 shrink-0"
            :class="{ 'stroke-[3]': verdict.met }"
            aria-hidden="true"
          />
          <span>
            {{ verdict.label }}
            <span class="sr-only">{{ verdict.met ? '(met)' : '(not met)' }}</span>
          </span>
        </li>
      </ul>

      <!-- Solved is a moment of its own: a large mark, the result, and the way on. -->
      <p
        class="flex items-start gap-2"
        :class="
          result.solved ? 'text-sm font-semibold text-foreground' : 'text-xs text-muted-foreground'
        "
      >
        <Check
          v-if="result.solved"
          class="size-6 shrink-0 stroke-[3]"
          :class="{ 'solved-mark': news }"
          aria-hidden="true"
        />
        <span role="status">{{
          news ? solvedSaid(outcome, result.solved ? next : null) : ''
        }}</span>
        <span v-if="!news">{{ outcome }}</span>
      </p>
      <Button
        v-if="result.solved && next"
        size="sm"
        class="h-auto max-w-full self-start py-1.5 text-left whitespace-normal pointer-coarse:min-h-11"
        @click="emit('next')"
      >
        Next challenge: {{ next.title }}
      </Button>

      <p
        v-show="hintShown"
        id="challenge-hint"
        class="well rounded-md px-2.5 py-2 text-xs leading-5"
      >
        {{ challenge.hint }}
      </p>

      <div class="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          :aria-expanded="hintShown"
          aria-controls="challenge-hint"
          @click="hintShown = !hintShown"
        >
          {{ hintShown ? 'Hide the hint' : 'Show a hint' }}
        </Button>
        <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="emit('restart')">
          Start over
        </Button>
        <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="emit('list')">
          All challenges
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
