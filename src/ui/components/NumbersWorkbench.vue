<script setup lang="ts">
import { computed, onActivated, onMounted, ref, useTemplateRef } from 'vue';
import { CircuitBoard } from '@lucide/vue';
import { hasNumbers, type NumberLink } from '@/core/numberLink';
import { Button } from '@/components/ui/button';
import type { CpuMoment } from '@/ui/cpuMoment';
import { WIDTHS } from '@/ui/logicView';
import { equationText, LENSES, lensLesson, lensTitle, widthAllowed } from '@/ui/numbersView';
import { useNumberLens } from '@/ui/useNumberLens';
import { useNumbersCommands } from '@/ui/useNumbersCommands';
import { useTopic } from '@/ui/useTopic';
import AppErrorNotice from './AppErrorNotice.vue';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import CommandPalette from './CommandPalette.vue';
import HeaderShell from './HeaderShell.vue';
import NumbersArithmetic from './NumbersArithmetic.vue';
import NumbersBcd from './NumbersBcd.vue';
import NumbersExtension from './NumbersExtension.vue';
import NumbersFlags from './NumbersFlags.vue';
import NumbersValue from './NumbersValue.vue';
import TopicOrigin from './TopicOrigin.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<NumberLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useNumberLens(() => props.moment.link);
const { topic } = useTopic();
const paletteOpen = ref(false);

// The control that opened this page is gone with the page it was on: focus starts here instead.
const page = useTemplateRef<HTMLElement>('page');
const focusPage = (): void => page.value?.focus({ preventScroll: true });
onMounted(focusPage);
onActivated(focusPage);
const commands = useNumbersCommands(lens, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back')
});

const request = computed(() => lens.request.value);
const solution = computed(() => lens.solution.value);
const equation = computed(() => equationText(request.value, solution.value));
/** Why the CPU's last instruction has nothing to show here, when it has nothing. */
const unavailable = computed(() => {
  const { link } = props.moment;
  return link && !hasNumbers(link)
    ? `${link.unavailable} The numbers below are ones to try by hand.`
    : null;
});
</script>

<!-- The number topic: what the CPU's last operation means as numbers, to read and to change. -->
<template>
  <HeaderShell badge="NM" menu-label="Topics and settings" @commands="paletteOpen = true">
    <template #context>
      <ArchitectureSwitch />
    </template>
  </HeaderShell>
  <CommandPalette v-model:open="paletteOpen" :commands="commands" />
  <AppErrorNotice />

  <main
    ref="page"
    class="numbers-page outline-none"
    tabindex="-1"
    aria-label="Number representation"
  >
    <!-- No section is wider than the page: what is wider inside one scrolls there. -->
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 *:min-w-0 sm:px-6">
      <TopicOrigin
        :moment="moment"
        :equation="equation"
        :edited="lens.isEdited.value"
        :from-cpu="lens.fromCpu.value !== null"
        :unavailable="unavailable"
        :aside="
          lens.discarded.value
            ? 'The CPU throws this result away and keeps only what it says about the two numbers.'
            : null
        "
        @seek="emit('seek', $event)"
        @back="emit('back')"
        @restore="lens.restore()"
      />

      <section class="border-t pt-5" aria-label="The numbers">
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 class="text-base font-semibold tracking-tight">{{ lensTitle(request) }}</h2>
          <div class="flex max-w-full flex-wrap items-center gap-2">
            <!-- Five choices are wider than a phone: there the row scrolls sideways. -->
            <div class="scroll-fade-x flex max-w-full overflow-x-auto p-px">
              <div class="toggle-group w-max shrink-0" role="group" aria-label="What to show">
                <Button
                  v-for="choice in LENSES"
                  :key="choice.id"
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2.5 text-xs pointer-coarse:h-11"
                  :aria-pressed="request.kind === choice.id"
                  @click="lens.pick(choice.id)"
                >
                  {{ choice.label }}
                </Button>
              </div>
            </div>
            <div
              class="segmented"
              :style="{ '--segments': WIDTHS.length, '--active': WIDTHS.indexOf(lens.width.value) }"
              role="group"
              aria-label="Width in bits"
            >
              <Button
                v-for="each in WIDTHS"
                :key="each"
                variant="ghost"
                size="sm"
                class="h-7 px-3 text-xs pointer-coarse:h-11"
                :disabled="!widthAllowed(request, each)"
                :aria-pressed="lens.width.value === each"
                @click="lens.setWidth(each)"
              >
                {{ each }}
              </Button>
            </div>
          </div>
        </div>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          {{ lensLesson(request) }}
          Press a bit of an input to flip it.
        </p>

        <div class="mt-4">
          <NumbersArithmetic
            v-if="(request.kind === 'add' || request.kind === 'subtract') && 'unsigned' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
          <NumbersExtension
            v-else-if="request.kind === 'extend' && 'fill' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
          <NumbersBcd
            v-else-if="request.kind === 'bcd' && 'digits' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
          <NumbersValue
            v-else-if="request.kind === 'value' && 'readings' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
        </div>
      </section>

      <!-- A value by itself, or one made wider, sets no flag: there is nothing to list. -->
      <div v-if="lens.view.value.flags.length > 0 || lens.view.value.note" class="border-t pt-5">
        <NumbersFlags :lens="lens" />
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
        <p class="max-w-prose min-w-0 flex-1 basis-64 text-xs text-pretty text-muted-foreground">
          The CPU does one thing to the bits, whatever they stand for. The flags are how it leaves
          both answers for the program to pick from.
        </p>
        <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="topic = 'logic'">
          <CircuitBoard />
          The gates behind it
        </Button>
      </div>
    </div>
  </main>
</template>
