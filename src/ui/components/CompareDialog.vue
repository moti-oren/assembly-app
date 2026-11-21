<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRight } from '@lucide/vue';
import { measure, type ComparedId } from '@/core/comparison';
import { COMPARISON_TASKS, type ComparisonTask } from '@/core/comparisonTasks';
import { formatLabel } from '@/core/shared/program';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { architectureLabel } from '@/ui/architectures';
import { COMPARED, TRAITS, codeText, metricRows } from '@/ui/comparisonView';

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ load: [task: ComparisonTask, id: ComparedId] }>();

const chosen = ref(0);
const task = computed(() => COMPARISON_TASKS[chosen.value]);
const measurements = computed(() => measure(task.value));
const rows = computed(() => metricRows(measurements.value));
/** The CPU whose program is on show where the three do not fit side by side. */
const listed = ref<ComparedId>(COMPARED[0]);
</script>

<template>
  <Dialog v-model:open="open">
    <!-- A phone gives it the whole screen. Only the body scrolls, with its scrollbar set in from the dialog's edge and corners; the title and the close button stay put. -->
    <DialogContent
      class="grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[calc(100svh-2rem)] sm:max-w-5xl sm:p-0"
    >
      <DialogHeader class="px-4 pt-4 pr-12 pb-4 sm:px-6 sm:pt-6">
        <DialogTitle>Compare the CPUs</DialogTitle>
        <DialogDescription>
          One task, written for each CPU: how big its program is, and what running it takes.
        </DialogDescription>
      </DialogHeader>

      <div
        class="mr-2 mb-2 flex min-h-0 flex-col gap-5 overflow-x-hidden overflow-y-auto pr-2.5 pb-4 pl-4 sm:pr-3.5 sm:pb-6 sm:pl-6"
      >
        <!--
          On a phone the tasks are one row that scrolls sideways, not three rows of the screen. Its
          right edge fades, and the scrollbar keeps clear of the buttons.
        -->
        <div
          class="flex shrink-0 flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pr-6 max-sm:pb-2 max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)] max-sm:[scrollbar-width:thin]"
          role="group"
          aria-label="Task"
        >
          <Button
            v-for="(each, index) in COMPARISON_TASKS"
            :key="each.id"
            :variant="index === chosen ? 'default' : 'outline'"
            size="sm"
            class="shrink-0 pointer-coarse:h-11"
            :class="{ 'font-semibold': index === chosen }"
            :aria-pressed="index === chosen"
            @click="chosen = index"
          >
            {{ each.name }}
          </Button>
        </div>

        <p class="max-w-prose text-sm leading-relaxed text-pretty">{{ task.lesson }}</p>

        <!--
          The fewest in each row stands out in a pill of its own; the others step back. On a phone
          each column is centred, so a number in a pill sits on the same axis as one without.
        -->
        <div class="well rounded-lg px-3.5 py-1.5">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-muted-foreground">
                <th scope="col" class="py-1.5 text-left font-normal">Measure</th>
                <th
                  v-for="id in COMPARED"
                  :key="id"
                  scope="col"
                  class="w-16 py-1.5 pl-3 text-right font-medium whitespace-nowrap text-foreground max-sm:text-center sm:w-24"
                >
                  {{ architectureLabel(id) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.label" class="border-t">
                <th scope="row" class="py-2 text-left font-normal">
                  {{ row.label }}
                  <span class="block text-xs text-muted-foreground">{{ row.hint }}</span>
                </th>
                <td
                  v-for="id in COMPARED"
                  :key="id"
                  class="py-2 pl-3 text-right font-mono text-code tabular-nums max-sm:text-center"
                  :class="{
                    'text-muted-foreground': row.least.length > 0 && !row.least.includes(id)
                  }"
                >
                  <span
                    class="-mr-2 inline-block min-w-9 rounded-md px-2 py-0.5 max-sm:mr-0 max-sm:text-center"
                    :class="
                      row.least.includes(id)
                        ? 'bg-muted font-semibold text-foreground inset-ring inset-ring-foreground/40'
                        : ''
                    "
                    >{{ row.values[id] }}</span
                  >
                  <span v-if="row.least.includes(id)" class="sr-only">(the fewest)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Three listings side by side need a wide screen; below it, one at a time. -->
        <div
          class="segmented self-start lg:hidden"
          :style="{ '--segments': COMPARED.length, '--active': COMPARED.indexOf(listed) }"
          role="group"
          aria-label="Program shown"
        >
          <Button
            v-for="id in COMPARED"
            :key="id"
            variant="ghost"
            size="sm"
            class="h-7 px-3 text-xs pointer-coarse:h-10"
            :aria-pressed="listed === id"
            @click="listed = id"
          >
            {{ architectureLabel(id) }}
          </Button>
        </div>
        <div class="grid gap-3 lg:grid-cols-3">
          <section
            v-for="id in COMPARED"
            :key="id"
            class="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card/60"
            :class="{ 'max-lg:hidden': id !== listed }"
            :aria-label="`${architectureLabel(id)} program`"
          >
            <header class="border-b px-3 py-2">
              <h3 class="text-sm font-semibold">{{ architectureLabel(id) }}</h3>
              <p class="text-xs text-muted-foreground">{{ TRAITS[id] }}</p>
            </header>
            <ol class="well flex-1 overflow-x-auto px-3 py-2 font-mono text-xs leading-6">
              <li
                v-for="(line, index) in measurements[id].listing"
                :key="index"
                class="flex gap-3 whitespace-nowrap"
              >
                <span class="w-6 shrink-0 text-muted-foreground">{{ formatLabel(index) }}</span>
                <span class="w-[11ch] shrink-0 text-muted-foreground">{{
                  codeText(line.bytes)
                }}</span>
                <span>{{ line.text }}</span>
              </li>
            </ol>
            <footer class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <p v-if="measurements[id].error" class="text-xs text-destructive">
                {{ measurements[id].error }}
              </p>
              <p v-else class="flex min-w-0 flex-wrap gap-x-1.5 text-xs">
                <span class="text-muted-foreground">Leaves</span>
                <span class="font-mono">{{ measurements[id].result }}</span>
              </p>
              <Button
                variant="secondary"
                size="sm"
                class="group/load shadow-(--shadow-thumb) pointer-coarse:h-11"
                @click="emit('load', task, id)"
              >
                Load into {{ architectureLabel(id) }}
                <ArrowRight
                  class="transition-transform group-hover/load:translate-x-0.5 calm:transition-none"
                />
              </Button>
            </footer>
          </section>
        </div>
        <p class="text-xs text-muted-foreground">
          Loading a program replaces that CPU's program and clears its history, as an example does.
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
