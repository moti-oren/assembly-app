<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowUpToLine, ChevronRight, Trash2, X } from '@lucide/vue';
import type { AssembledLine } from '@/core/encode';
import { formatInstruction, type Instruction } from '@/core/instructions';
import { formatBytes, formatHex } from '@/core/numbers';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const props = defineProps<{
  program: Instruction[];
  /** The machine code of each line, shown beside it. */
  assembled: AssembledLine[];
  ip: number;
  /** Line new instructions are inserted before; null = the end. */
  insertAt: number | null;
  /** The program line executed last, if the last instruction came from the program. */
  lastLine: number | null;
  finished: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  remove: [index: number];
  /** Asks for the machine code of a line to be taken apart. */
  inspect: [index: number];
  /** Asks for the examples menu, from the empty program's prompt. */
  examples: [];
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

const ROW =
  'group grid h-7 pointer-coarse:h-11 grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_auto_auto] items-center gap-1 pr-1 pl-2';

function machineCode(index: number): string {
  return formatBytes(props.assembled[index].encoding.bytes);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Program</CardTitle>
      <CardDescription>
        <template v-if="program.length === 0">No lines yet</template>
        <template v-else-if="finished">Finished</template>
        <template v-else>Next: {{ formatLabel(ip) }}</template>
      </CardDescription>
      <CardAction class="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              aria-label="Clear the program"
              :disabled="program.length === 0"
              @click="emit('clear')"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear the program</TooltipContent>
        </Tooltip>
      </CardAction>
    </CardHeader>

    <CardContent>
      <ol
        ref="list"
        class="relative max-h-80 overflow-y-auto rounded-lg border lg:max-h-112 bg-muted/30 py-1 font-mono text-code"
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
              class="flex w-full items-center gap-2 py-0.5 font-sans text-2xs pointer-coarse:min-h-11 text-muted-foreground hover:text-foreground"
              @click="emit('update:insertAt', null)"
            >
              <span class="h-px flex-1 border-t border-dashed border-foreground/40" />
              new lines go here ·
              <span class="underline underline-offset-2">add at the end instead</span>
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
            <button
              v-if="assembled[index]"
              type="button"
              class="hidden max-w-36 truncate rounded-sm px-1 text-2xs pointer-coarse:self-stretch pointer-coarse:leading-11 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:block"
              :class="{ 'text-destructive': assembled[index].encoding.problem }"
              :title="`Machine code at offset ${formatHex(assembled[index].offset, 16)}h. Click to take it apart.`"
              @click="emit('inspect', index)"
            >
              {{ machineCode(index) }}
            </button>
            <span v-else />
            <span
              class="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
            >
              <Button
                variant="ghost"
                size="icon-xs"
                class="pointer-coarse:size-11"
                title="Insert new lines above this one"
                aria-label="Insert new lines above this one"
                @click="emit('update:insertAt', index)"
              >
                <ArrowUpToLine />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                class="hover:text-destructive pointer-coarse:size-11"
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
        Build an instruction and press
        <KbdGroup><Kbd>⇧</Kbd><Kbd>Enter</Kbd></KbdGroup>
        to add it as a line, or
        <Button variant="link" size="sm" class="h-auto p-0" @click="emit('examples')"
          >start from an example</Button
        >.
      </p>
    </CardContent>
  </Card>
</template>
