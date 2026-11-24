<script setup lang="ts">
import { onActivated, onMounted, ref, useTemplateRef } from 'vue';
import { Binary, MemoryStick, Workflow } from '@lucide/vue';
import type { AluLink } from '@/core/aluLink';
import { Button } from '@/components/ui/button';
import type { CpuMoment } from '@/ui/cpuMoment';
import { circuitLesson, circuitTitle, FREE_OPERATIONS, WIDTHS } from '@/ui/logicView';
import { useLogicCommands } from '@/ui/useLogicCommands';
import { useLogicLens } from '@/ui/useLogicLens';
import { useTopic } from '@/ui/useTopic';
import AppErrorNotice from './AppErrorNotice.vue';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import CommandPalette from './CommandPalette.vue';
import HeaderShell from './HeaderShell.vue';
import LogicAdder from './LogicAdder.vue';
import LogicBitwise from './LogicBitwise.vue';
import LogicFaultNote from './LogicFaultNote.vue';
import LogicFlags from './LogicFlags.vue';
import LogicOrigin from './LogicOrigin.vue';
import LogicShifter from './LogicShifter.vue';
import LogicSlice from './LogicSlice.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<AluLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useLogicLens(() => props.moment.link);
const { topic } = useTopic();
const paletteOpen = ref(false);

// The control that opened this page is gone with the page it was on: focus starts here instead.
const page = useTemplateRef<HTMLElement>('page');
const focusPage = (): void => page.value?.focus({ preventScroll: true });
onMounted(focusPage);
onActivated(focusPage);
const commands = useLogicCommands(lens, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back')
});
</script>

<!-- The logic topic: the gates behind the CPU's last operation, to read and to change. -->
<template>
  <HeaderShell badge="LG" menu-label="Topics and settings" @commands="paletteOpen = true">
    <template #context>
      <ArchitectureSwitch />
    </template>
  </HeaderShell>
  <CommandPalette v-model:open="paletteOpen" :commands="commands" />
  <AppErrorNotice />

  <main ref="page" class="logic-page outline-none" tabindex="-1" aria-label="Digital logic">
    <!-- No section is wider than the page: what is wider inside one scrolls there. -->
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 *:min-w-0 sm:px-6">
      <LogicOrigin
        :lens="lens"
        :moment="moment"
        @seek="emit('seek', $event)"
        @back="emit('back')"
      />

      <section class="border-t pt-5" aria-label="The circuit">
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 class="text-base font-semibold tracking-tight">
            {{ circuitTitle(lens.request.value) }}
          </h2>
          <div class="flex max-w-full flex-wrap items-center gap-2">
            <!-- Seven choices are wider than a phone: there the row scrolls sideways. -->
            <div class="scroll-fade-x flex max-w-full overflow-x-auto p-px">
              <div class="toggle-group w-max shrink-0" role="group" aria-label="Operation">
                <Button
                  v-for="choice in FREE_OPERATIONS"
                  :key="choice.id"
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2.5 text-xs pointer-coarse:h-11"
                  :aria-pressed="lens.operation.value === choice.id"
                  @click="lens.pick(choice.id)"
                >
                  {{ choice.label }}
                </Button>
              </div>
            </div>
            <div
              class="segmented"
              :style="{
                '--segments': WIDTHS.length,
                '--active': WIDTHS.indexOf(lens.request.value.width)
              }"
              role="group"
              aria-label="Width in bits"
            >
              <Button
                v-for="each in WIDTHS"
                :key="each"
                variant="ghost"
                size="sm"
                class="h-7 px-3 text-xs pointer-coarse:h-11"
                :aria-pressed="lens.request.value.width === each"
                @click="lens.setWidth(each)"
              >
                {{ each }}
              </Button>
            </div>
          </div>
        </div>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          {{ circuitLesson(lens.request.value) }}
          Press a bit of an input to flip it.
        </p>

        <LogicFaultNote :lens="lens" />

        <div class="mt-3">
          <LogicShifter v-if="lens.request.value.kind === 'shift'" :lens="lens" />
          <LogicAdder
            v-else-if="lens.request.value.kind === 'add' || lens.request.value.kind === 'subtract'"
            :lens="lens"
          />
          <LogicBitwise v-else :lens="lens" />
        </div>
      </section>

      <div
        class="grid grid-cols-[minmax(0,1fr)] gap-6 border-t pt-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        <LogicSlice :lens="lens" />
        <LogicFlags :lens="lens" />
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
        <p class="max-w-prose min-w-0 flex-1 basis-64 text-xs text-pretty text-muted-foreground">
          These are the simplest circuits that work out the same bits. A real chip uses faster ones,
          such as an adder that does not wait for its carry to ripple, but every wire you see here
          carries the value the CPU computed.
        </p>
        <!-- On a phone the two ways on are one column, each as wide as the page. -->
        <div class="flex flex-wrap gap-2 max-md:w-full max-md:flex-col">
          <Button
            variant="outline"
            size="sm"
            class="pointer-coarse:h-11"
            @click="topic = 'numbers'"
          >
            <Binary />
            What it means as numbers
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="pointer-coarse:h-11"
            @click="topic = 'storage'"
          >
            <MemoryStick />
            How the result is kept
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="pointer-coarse:h-11"
            @click="topic = 'control'"
          >
            <Workflow />
            What picks the operation
          </Button>
        </div>
      </div>
    </div>
  </main>
</template>
