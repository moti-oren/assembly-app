<script setup lang="ts">
import { computed } from 'vue';
import type { ArithmeticSolution } from '@/core/representation/arithmetic';
import { compareRows, compareSummary, compareWarning } from '@/ui/numbersCompare';
import type { ConditionSet } from '@/ui/numbersConditions';

const props = defineProps<{
  /** The jumps of the CPU on show. */
  conditions: ConditionSet;
  /** A − B, with nothing more taken off. */
  solution: ArithmeticSolution;
}>();

const rows = computed(() => compareRows(props.conditions, props.solution));
const summary = computed(() => compareSummary(props.solution));
const warning = computed(() => compareWarning(rows.value));
</script>

<!-- The two numbers as a program compares them: every conditional jump, and whether it goes. -->
<template>
  <section aria-label="Conditional jumps">
    <h3 class="text-sm font-semibold">What a jump would make of it</h3>
    <p class="mt-2 max-w-prose text-sm text-pretty text-muted-foreground">
      {{ conditions.lead }}
    </p>
    <p
      class="mt-2 max-w-prose text-sm text-pretty"
      :class="{ 'font-semibold': summary.split }"
      aria-live="polite"
    >
      {{ summary.text }}
    </p>

    <!-- Wider than a phone, where it scrolls sideways: what a jump does comes first for that. -->
    <div
      class="scroll-fade-x mt-3 overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      tabindex="0"
      role="region"
      aria-label="Conditional jumps table"
    >
      <table class="w-full min-w-112 text-sm">
        <caption class="sr-only">
          Which conditional jumps are taken for A − B
        </caption>
        <thead>
          <tr class="border-b text-left text-xs text-muted-foreground">
            <th scope="col" class="px-1.5 py-1.5 font-medium">Jump</th>
            <th scope="col" class="px-1.5 py-1.5 font-medium">Now it</th>
            <th scope="col" class="px-1.5 py-1.5 font-medium">Asks</th>
            <th scope="col" class="px-1.5 py-1.5 font-medium">Numbers</th>
            <th scope="col" class="px-1.5 py-1.5 font-medium">Goes by</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="row in rows"
            :key="row.mnemonic"
            :class="{ 'text-muted-foreground': !row.taken }"
          >
            <th scope="row" class="px-1.5 py-2 text-left font-mono text-code font-semibold">
              {{ row.mnemonic }}
            </th>
            <td class="px-1.5 py-2 whitespace-nowrap" :class="{ 'font-semibold': row.taken }">
              {{ row.outcome }}
              <span v-if="row.wrong" class="ms-1 text-xs font-semibold text-foreground">
                against the numbers
              </span>
            </td>
            <td class="px-1.5 py-2 whitespace-nowrap">{{ row.asks }}</td>
            <td class="px-1.5 py-2 font-mono whitespace-nowrap tabular-nums">
              {{ row.numbers }}
              <span class="font-sans text-xs">{{ row.truth ? 'true' : 'false' }}</span>
            </td>
            <td class="px-1.5 py-2 font-mono text-xs whitespace-nowrap">{{ row.when }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The live region is there before its text is, so the text is announced when it comes. -->
    <div aria-live="polite">
      <p
        v-if="warning"
        class="mt-3 max-w-prose text-xs text-pretty"
        :class="warning.wrong ? 'text-foreground' : 'text-muted-foreground'"
      >
        {{ warning.text }}
      </p>
    </div>
  </section>
</template>
