<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StackView } from '@/ui/stackView';
import InfoTip from './InfoTip.vue';

defineProps<{
  view: StackView;
}>();

const emit = defineEmits<{
  /** Asks the memory panel to show the bytes at the top of the stack. */
  memory: [];
}>();
</script>

<!-- The stack of the CPU on show: its values from the top down, and who put each there. -->
<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle
        role="heading"
        aria-level="2"
        class="flex items-center gap-1 group-data-[size=sm]/card:text-base"
      >
        Stack
        <InfoTip label="About the stack">
          <p>
            The stack is a part of memory that grows down: the newest value is at the lowest
            address, where the stack pointer points. Each row says what the value is and which
            instruction put it there.
          </p>
          <p class="mt-2">
            Taking a value off only moves the stack pointer. The value stays in memory, greyed here,
            until something is put over it.
          </p>
        </InfoTip>
      </CardTitle>
      <CardAction class="flex items-center gap-2">
        <Badge variant="outline" class="font-mono text-muted-foreground">
          <span class="sr-only">Stack pointer:</span>
          {{ view.pointer }}
        </Badge>
        <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="emit('memory')">
          In memory
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p v-if="view.entries.length === 0" class="text-code leading-5 text-muted-foreground">
        {{ view.empty }}
      </p>
      <div
        v-else
        class="overflow-x-auto rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        tabindex="0"
        role="region"
        aria-label="Stack values"
      >
        <table
          class="w-full border-separate border-spacing-y-0.5 text-sm"
          aria-label="Stack, top first"
        >
          <thead>
            <tr class="text-left text-xs text-muted-foreground">
              <th scope="col" class="w-8 font-normal"><span class="sr-only">Top</span></th>
              <th scope="col" class="pr-3 font-normal">Address</th>
              <th scope="col" class="pr-3 font-normal">Value</th>
              <th scope="col" class="pr-3 font-normal">What it is</th>
              <th scope="col" class="font-normal">Put there by</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in view.entries"
              :key="entry.key"
              :class="{ 'text-muted-foreground': entry.popped }"
            >
              <td class="font-mono text-xs text-pointer">
                <template v-if="entry.top">
                  <span aria-hidden="true">SP▸</span>
                  <span class="sr-only">Top of the stack</span>
                </template>
              </td>
              <td class="pr-3 font-mono text-code tabular-nums">{{ entry.address }}</td>
              <td class="pr-3 font-mono text-code tabular-nums">
                <span
                  class="rounded-sm px-1 py-0.5"
                  :class="{
                    'bg-changed text-changed-foreground': entry.change === 'write',
                    'bg-pointer/15 text-foreground': entry.change === 'read'
                  }"
                  >{{ entry.value }}</span
                >
                <span v-if="entry.change === 'write'" class="sr-only">(just written)</span>
              </td>
              <td class="pr-3" :class="{ 'font-medium': entry.returns && !entry.popped }">
                {{ entry.label }}
                <span v-if="entry.popped" class="block text-xs">taken off, still in memory</span>
              </td>
              <td class="font-mono text-xs whitespace-nowrap text-muted-foreground">
                {{ entry.source ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="view.hidden > 0" class="mt-2 text-xs text-muted-foreground">
        and {{ view.hidden }} older below these.
      </p>
      <!-- Always there, so a screen reader hears the note when it is filled. -->
      <p class="text-xs text-pretty" :class="view.note ? 'mt-2' : 'sr-only'" role="status">
        {{ view.note ?? '' }}
      </p>
    </CardContent>
  </Card>
</template>
