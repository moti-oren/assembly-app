<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ArrowUpToLine,
  ChevronRight,
  FastForward,
  Pause,
  StepForward,
  Trash2,
  X
} from '@lucide/vue';
import { formatInstruction, type Instruction } from '@/core/instructions';
import { formatLabel } from '@/core/operands';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RunSpeed } from '@/ui/useCpu';

const props = defineProps<{
  program: Instruction[];
  ip: number;
  /** Line new instructions are inserted before; null = the end. */
  insertAt: number | null;
  /** The program line executed last, if the last instruction came from the program. */
  lastLine: number | null;
  finished: boolean;
  /** True while the program is running line by line. */
  running: boolean;
  speed: RunSpeed;
}>();

const emit = defineEmits<{
  step: [];
  run: [];
  pause: [];
  'update:speed': [speed: RunSpeed];
  clear: [];
  remove: [index: number];
  'update:insertAt': [index: number | null];
}>();

const insertionPoint = computed(() => props.insertAt ?? props.program.length);

/** Lines some jump or call points at; they get a visible label. */
const targets = computed(() => {
  const set = new Set<number>();
  for (const instruction of props.program) {
    for (const operand of instruction.operands) {
      if (operand.type === 'label') set.add(operand.target);
    }
  }
  return set;
});

const SPEED_LABELS: Record<RunSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  instant: 'Instant'
};

const list = ref<HTMLElement | null>(null);
/** Where the IP marker sits inside the list; it slides there instead of jumping. */
const marker = ref<{ top: number; height: number } | null>(null);

function placeMarker(): void {
  const lines = list.value;
  const row = lines?.querySelector<HTMLElement>(
    `[data-row="${props.finished ? 'end' : props.ip}"]`
  );
  if (!lines || !row) {
    marker.value = null;
    return;
  }
  marker.value = { top: row.offsetTop, height: row.offsetHeight };

  const bottom = row.offsetTop + row.offsetHeight;
  if (row.offsetTop < lines.scrollTop) {
    lines.scrollTo({ top: row.offsetTop - 4, behavior: 'smooth' });
  } else if (bottom > lines.scrollTop + lines.clientHeight) {
    lines.scrollTo({ top: bottom - lines.clientHeight + 4, behavior: 'smooth' });
  }
}

onMounted(placeMarker);
watch(() => [props.ip, props.finished, props.program, props.insertAt], placeMarker, {
  flush: 'post'
});

const ROW = 'group grid h-7 grid-cols-[1.25rem_2.75rem_1fr_auto] items-center gap-1 pr-1 pl-2';
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Program</CardTitle>
      <CardDescription>
        <template v-if="program.length === 0">Empty</template>
        <template v-else-if="finished">Finished</template>
        <template v-else>Next: {{ formatLabel(ip) }}</template>
      </CardDescription>
      <CardAction class="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear the program"
              :disabled="program.length === 0"
              @click="emit('clear')"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear the program</TooltipContent>
        </Tooltip>
        <Select :model-value="speed" @update:model-value="emit('update:speed', $event as RunSpeed)">
          <SelectTrigger size="sm" class="w-26" aria-label="Run speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="(label, value) in SPEED_LABELS" :key="value" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button v-if="running" variant="outline" size="sm" @click="emit('pause')">
          <Pause />
          Pause
        </Button>
        <Button v-else variant="outline" size="sm" :disabled="finished" @click="emit('run')">
          <FastForward />
          Run
        </Button>
        <Button size="sm" :disabled="finished" @click="emit('step')">
          <StepForward />
          Step
        </Button>
      </CardAction>
    </CardHeader>

    <CardContent>
      <ol
        ref="list"
        class="relative max-h-80 overflow-y-auto rounded-lg border bg-muted/30 py-1 font-mono text-[13px]"
        aria-label="Program lines"
      >
        <li
          v-if="marker"
          class="pointer-events-none absolute inset-x-0 top-0 flex items-center bg-pointer/10 pl-2 shadow-[inset_2px_0_0_var(--pointer)] transition-[translate,height] duration-300 ease-out motion-reduce:transition-none"
          :style="{ translate: `0 ${marker.top}px`, height: `${marker.height}px` }"
          aria-hidden="true"
        >
          <ChevronRight class="size-4 text-pointer" />
        </li>
        <template v-for="(instruction, index) in program" :key="index">
          <li v-if="insertionPoint === index && insertAt !== null" class="px-2">
            <button
              type="button"
              class="flex w-full items-center gap-2 py-0.5 font-sans text-[11px] text-muted-foreground hover:text-foreground"
              title="Click to add new lines at the end instead"
              @click="emit('update:insertAt', null)"
            >
              <span class="h-px flex-1 border-t border-dashed border-foreground/40" />
              new lines go here
              <X class="size-3" />
            </button>
          </li>
          <li
            :class="[ROW, ip === index ? '' : 'hover:bg-muted/60']"
            :data-row="index"
            :aria-current="ip === index ? 'step' : undefined"
          >
            <span />
            <span
              class="text-xs"
              :class="
                targets.has(index) ? 'font-semibold text-foreground' : 'text-muted-foreground'
              "
              >{{ formatLabel(index) }}{{ targets.has(index) ? ':' : '' }}</span
            >
            <span class="truncate" :class="{ 'font-semibold': lastLine === index }"
              ><span :data-loc="`line:${index}`">{{ formatInstruction(instruction) }}</span></span
            >
            <span
              class="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
            >
              <Button
                variant="ghost"
                size="icon-xs"
                title="Insert new lines above this one"
                aria-label="Insert new lines above this one"
                @click="emit('update:insertAt', index)"
              >
                <ArrowUpToLine />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                class="hover:text-destructive"
                title="Delete this line"
                aria-label="Delete this line"
                @click="emit('remove', index)"
              >
                <X />
              </Button>
            </span>
          </li>
        </template>
        <li :class="ROW" data-row="end" :aria-current="finished ? 'step' : undefined">
          <span />
          <span
            class="text-xs"
            :class="
              targets.has(program.length)
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            "
            >{{ formatLabel(program.length) }}{{ targets.has(program.length) ? ':' : '' }}</span
          >
          <span class="font-sans text-xs text-muted-foreground">end of program</span>
        </li>
      </ol>

      <p v-if="program.length === 0" class="mt-3 text-sm text-muted-foreground">
        Build an instruction above and press
        <KbdGroup><Kbd>⇧</Kbd><Kbd>Enter</Kbd></KbdGroup>
        to add it here, or open <span class="font-medium text-foreground">Examples</span>.
      </p>
    </CardContent>
  </Card>
</template>
