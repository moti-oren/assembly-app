<script setup lang="ts">
import { computed, onActivated, onMounted, ref, useTemplateRef } from 'vue';
import { CircuitBoard, Workflow } from '@lucide/vue';
import type { RegisterLink, RegisterWrite } from '@/core/registerLink';
import { Button } from '@/components/ui/button';
import type { CpuMoment } from '@/ui/cpuMoment';
import { WIDTHS } from '@/ui/logicView';
import { equationText, registerChoices, registerTitle, unavailableText } from '@/ui/storageView';
import { useStorageCommands } from '@/ui/useStorageCommands';
import { useStorageFile } from '@/ui/useStorageFile';
import { useStorageLens } from '@/ui/useStorageLens';
import { useTopic } from '@/ui/useTopic';
import AppErrorNotice from './AppErrorNotice.vue';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import CommandPalette from './CommandPalette.vue';
import HeaderShell from './HeaderShell.vue';
import StorageCell from './StorageCell.vue';
import StorageFile from './StorageFile.vue';
import StorageRegister from './StorageRegister.vue';
import TopicOrigin from './TopicOrigin.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<RegisterLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useStorageLens(() => props.moment.link);
const file = useStorageFile(() => props.moment.link);
const { topic } = useTopic();
const paletteOpen = ref(false);

// The control that opened this page is gone with the page it was on: focus starts here instead.
const page = useTemplateRef<HTMLElement>('page');
const focusPage = (): void => page.value?.focus({ preventScroll: true });
onMounted(focusPage);
onActivated(focusPage);
const commands = useStorageCommands(lens, file, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back')
});

const equation = computed(() => equationText(lens.write.value, lens.solution.value.stored));
/** Why the CPU's last instruction has no register to show here, when it has none. */
const unavailable = computed(() => unavailableText(props.moment.link));
// A register picked in the file is shown where a register is: the focus follows it there.
const registerSection = useTemplateRef<HTMLElement>('registerSection');
function showRegister(write: RegisterWrite): void {
  lens.show(write);
  registerSection.value?.focus();
}

/** The registers the CPU's instruction wrote, when it wrote more than one. */
const written = computed(() => registerChoices(lens.fromCpu.value?.writes ?? []));
</script>

<!-- The storage topic: the flip-flops that keep what the CPU's last instruction wrote. -->
<template>
  <HeaderShell badge="ST" menu-label="Topics and settings" @commands="paletteOpen = true">
    <template #context>
      <ArchitectureSwitch />
    </template>
  </HeaderShell>
  <CommandPalette v-model:open="paletteOpen" :commands="commands" />
  <AppErrorNotice />

  <main ref="page" class="logic-page outline-none" tabindex="-1" aria-label="How a value is kept">
    <!-- No section is wider than the page: what is wider inside one scrolls there. -->
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 *:min-w-0 sm:px-6">
      <TopicOrigin
        :moment="moment"
        :equation="equation"
        :edited="lens.isEdited.value"
        :from-cpu="lens.fromCpu.value !== null"
        :unavailable="unavailable"
        :aside="lens.asRun.value ? (lens.fromCpu.value?.note ?? null) : null"
        @seek="emit('seek', $event)"
        @back="emit('back')"
        @restore="lens.restore()"
      />

      <section
        ref="registerSection"
        class="border-t pt-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabindex="-1"
        :aria-label="`The register ${registerTitle(lens.write.value)}`"
      >
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 class="text-base font-semibold tracking-tight">
            {{ registerTitle(lens.write.value) }}
          </h2>
          <div class="flex max-w-full flex-wrap items-center gap-2">
            <div
              v-if="written.length > 0"
              class="toggle-group"
              role="group"
              aria-label="Register written"
            >
              <Button
                v-for="(each, index) in written"
                :key="each.register"
                variant="ghost"
                size="sm"
                class="h-7 px-2.5 font-mono text-xs pointer-coarse:h-11"
                :aria-pressed="!lens.isEdited.value && lens.chosen.value === index"
                @click="lens.chooseRegister(index)"
              >
                {{ each.register }}
              </Button>
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
          A register is one flip-flop per bit, all on the same clock. A flip-flop takes its input at
          the moment the clock rises, and only if its write line is 1. Press a bit of the input or
          of the write line to flip it.
        </p>

        <div class="mt-3">
          <StorageRegister :lens="lens" />
        </div>
      </section>

      <div class="border-t pt-5">
        <StorageCell :lens="lens" />
      </div>

      <div class="border-t pt-5">
        <StorageFile :file="file" @show="showRegister" />
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
        <p class="max-w-prose min-w-0 flex-1 basis-64 text-xs text-pretty text-muted-foreground">
          These are the simplest cells that behave the same. A real chip builds them from fewer
          transistors, but the idea is this one: a loop of gates holds the bit, and the clock says
          when it may change.
        </p>
        <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="topic = 'logic'">
          <CircuitBoard />
          The gates that work a value out
        </Button>
        <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="topic = 'control'">
          <Workflow />
          What turns the write line on
        </Button>
      </div>
    </div>
  </main>
</template>
