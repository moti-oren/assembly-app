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
import { COMPARED, codeText, metricRows } from '@/ui/comparisonView';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ load: [task: ComparisonTask, id: ComparedId] }>();

const chosen = ref(0);
const task = computed(() => COMPARISON_TASKS[chosen.value]);
const measurements = computed(() => measure(task.value));
const rows = computed(() => metricRows(t.value, measurements.value));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto sm:max-w-5xl sm:p-6">
      <DialogHeader>
        <DialogTitle>{{ t.compare.title }}</DialogTitle>
        <DialogDescription>{{ t.compare.description }}</DialogDescription>
      </DialogHeader>

      <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t.compare.task">
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

      <p class="ui-text max-w-prose text-sm leading-relaxed text-pretty">{{ task.lesson }}</p>

      <!-- The fewest in each row stands out: the others are dimmed rather than the winner coloured. -->
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-muted-foreground">
            <th scope="col" class="pb-1.5 text-start font-normal">{{ t.compare.measure }}</th>
            <th
              v-for="id in COMPARED"
              :key="id"
              scope="col"
              class="pb-1.5 ps-3 text-end font-medium whitespace-nowrap text-foreground"
            >
              {{ architectureLabel(id) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label" class="border-t">
            <th scope="row" class="py-1.5 text-start font-normal">
              {{ row.label }}
              <span class="block text-xs text-muted-foreground">{{ row.hint }}</span>
            </th>
            <td
              v-for="id in COMPARED"
              :key="id"
              class="py-1.5 ps-3 text-end font-mono tabular-nums"
              :class="
                row.least.includes(id)
                  ? 'font-semibold'
                  : { 'text-muted-foreground': row.least.length > 0 }
              "
            >
              {{ row.values[id] }}
              <span v-if="row.least.includes(id)" class="sr-only">{{ t.compare.fewest }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="grid gap-3 md:grid-cols-3">
        <section
          v-for="id in COMPARED"
          :key="id"
          class="flex min-w-0 flex-col rounded-lg border"
          :aria-label="t.compare.program(architectureLabel(id))"
        >
          <header class="border-b px-3 py-2">
            <h3 class="text-sm font-semibold">{{ architectureLabel(id) }}</h3>
            <p class="text-xs text-muted-foreground">{{ t.compare.traits[id] }}</p>
          </header>
          <ol dir="ltr" class="flex-1 overflow-x-auto px-3 py-2 font-mono text-xs leading-6">
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
          <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
            <p v-if="measurements[id].error" class="text-xs text-destructive">
              {{ measurements[id].error }}
            </p>
            <p v-else class="flex min-w-0 flex-wrap gap-x-1.5 text-xs">
              <span class="text-muted-foreground">{{ t.compare.leaves }}</span>
              <span class="font-mono">{{ measurements[id].result }}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              class="pointer-coarse:h-11"
              @click="emit('load', task, id)"
            >
              {{ t.compare.load(architectureLabel(id)) }}
              <ArrowRight class="rtl:-scale-x-100" />
            </Button>
          </footer>
        </section>
      </div>
      <p class="ui-text text-xs text-muted-foreground">
        {{ t.compare.loadNote }}
      </p>
    </DialogContent>
  </Dialog>
</template>
