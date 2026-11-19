<script setup lang="ts" generic="Instruction extends ProgramInstruction">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowUpToLine, ChevronRight, Trash2, X } from '@lucide/vue';
import { formatBytes } from '@/core/shared/numbers';
import { formatLabel, isLabel, type ProgramInstruction } from '@/core/shared/program';
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
import type { CodePlace, LineCode } from '@/ui/programCode';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  program: Instruction[];
  /** How the architecture writes an instruction. */
  format: (instruction: Instruction) => string;
  /** The machine code of each line, shown beside it. */
  code: LineCode[];
  /** Where a line's code sits, as the tooltip says it. */
  codePlace: CodePlace;
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
      if (isLabel(operand)) set.add(operand.target);
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
  return formatBytes(props.code[index].bytes);
}

/** Where a line's code sits, in words: an offset in the code or an address in memory. */
function placeText(address: number): string {
  const place = props.codePlace(address);
  return t.value.program[place.kind](place.value);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.program.title }}</CardTitle>
      <CardDescription>
        <template v-if="program.length === 0">{{ t.program.empty }}</template>
        <template v-else-if="finished">{{ t.program.finished }}</template>
        <template v-else>{{ t.program.next(formatLabel(ip)) }}</template>
      </CardDescription>
      <CardAction class="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              :aria-label="t.program.clear"
              :disabled="program.length === 0"
              @click="emit('clear')"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t.program.clear }}</TooltipContent>
        </Tooltip>
      </CardAction>
    </CardHeader>

    <CardContent>
      <ol
        ref="list"
        class="relative max-h-80 overflow-y-auto rounded-lg lg:max-h-112 bg-inset py-1 font-mono text-code"
        :aria-label="t.program.lines"
      >
        <li
          v-if="marker"
          class="pointer-events-none absolute inset-x-0 top-0 flex items-center bg-pointer/15 pl-2 shadow-[inset_3px_0_0_var(--pointer)] transition-[translate,height] duration-300 ease-out calm:transition-none"
          :style="{ translate: `0 ${marker.top}px`, height: `${marker.height}px` }"
          aria-hidden="true"
        >
          <ChevronRight class="size-4 text-pointer" />
        </li>
        <template v-for="(instruction, index) in program" :key="index">
          <li v-if="insertionPoint === index && insertAt !== null" class="px-2">
            <button
              type="button"
              class="flex w-full items-center gap-2 py-0.5 font-sans text-xs pointer-coarse:min-h-11 text-muted-foreground hover:text-foreground"
              @click="emit('update:insertAt', null)"
            >
              <span class="h-px flex-1 border-t border-dashed border-foreground/40" />
              {{ t.program.insertHere }}
              <span class="underline underline-offset-2">{{ t.program.addAtEnd }}</span>
            </button>
          </li>
          <li
            :class="[ROW, ip === index ? '' : 'hover:bg-muted/60']"
            :data-row="index"
            :aria-current="ip === index ? 'step' : undefined"
          >
            <!-- The line that ran last, unless the IP marker already sits on it. -->
            <span class="flex justify-center" aria-hidden="true">
              <span
                v-if="lastLine === index && ip !== index"
                class="size-1.5 rounded-full bg-muted-foreground"
                :title="t.program.ranLast"
              />
            </span>
            <span
              class="text-xs"
              :class="
                targets.has(index) ? 'font-semibold text-foreground' : 'text-muted-foreground'
              "
              >{{ formatLabel(index) }}{{ targets.has(index) ? ':' : '' }}</span
            >
            <span class="truncate" :class="{ 'font-semibold': lastLine === index }"
              ><span :data-loc="`line:${index}`">{{ format(instruction) }}</span></span
            >
            <Tooltip v-if="code[index]">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="hidden max-w-36 truncate rounded-sm px-1 text-xs pointer-coarse:self-stretch pointer-coarse:leading-11 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:block"
                  :class="{ 'text-destructive': code[index].problem }"
                  @click="emit('inspect', index)"
                >
                  {{ machineCode(index) }}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ t.program.codeAt(placeText(code[index].address)) }}
              </TooltipContent>
            </Tooltip>
            <span v-else />
            <span
              class="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="pointer-coarse:size-11"
                    :aria-label="t.program.insertAbove"
                    @click="emit('update:insertAt', index)"
                  >
                    <ArrowUpToLine />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ t.program.insertAbove }}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="hover:text-destructive pointer-coarse:size-11"
                    :aria-label="t.program.remove"
                    @click="emit('remove', index)"
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ t.program.remove }}</TooltipContent>
              </Tooltip>
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
          <span class="font-sans text-xs text-muted-foreground">{{ t.program.end }}</span>
        </li>
      </ol>

      <p v-if="program.length === 0" class="ui-text mt-3 text-sm text-muted-foreground">
        {{ t.program.startBefore }}
        <KbdGroup><Kbd>⇧</Kbd><Kbd>Enter</Kbd></KbdGroup>
        {{ t.program.startMiddle }}
        <Button variant="link" size="sm" class="h-auto p-0" @click="emit('examples')">{{
          t.program.startLink
        }}</Button>{{ t.program.startAfter }}
      </p>
    </CardContent>
  </Card>
</template>
