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
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto sm:max-w-5xl sm:p-6">
      <DialogHeader>
        <DialogTitle>Compare the CPUs</DialogTitle>
        <DialogDescription>
          One task, written for each CPU: how big its program is, and what running it takes.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Task">
        <Button
          v-for="(each, index) in COMPARISON_TASKS"
          :key="each.id"
          :variant="index === chosen ? 'default' : 'outline'"
          size="sm"
          class="pointer-coarse:h-11"
          :class="{ 'font-semibold': index === chosen }"
          :aria-pressed="index === chosen"
          @click="chosen = index"
        >
          {{ each.name }}
        </Button>
      </div>

      <p class="max-w-prose text-sm leading-relaxed text-pretty">{{ task.lesson }}</p>

      <!-- The fewest in each row stands out in a pill of its own; the others step back. -->
      <div class="well rounded-lg px-3.5 py-1.5">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-muted-foreground">
              <th scope="col" class="py-1.5 text-left font-normal">Measure</th>
              <th
                v-for="id in COMPARED"
                :key="id"
                scope="col"
                class="w-24 py-1.5 pl-3 text-right font-medium whitespace-nowrap text-foreground"
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
                class="py-2 pl-3 text-right font-mono text-code"
                :class="{
                  'text-muted-foreground': row.least.length > 0 && !row.least.includes(id)
                }"
              >
                <span
                  class="-mr-2 inline-block min-w-9 rounded-md px-2 py-0.5"
                  :class="
                    row.least.includes(id)
                      ? 'bg-pointer/15 font-semibold text-foreground inset-ring inset-ring-pointer/40'
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

      <div class="grid gap-3 md:grid-cols-3">
        <section
          v-for="id in COMPARED"
          :key="id"
          class="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card/60"
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
    </DialogContent>
  </Dialog>
</template>
