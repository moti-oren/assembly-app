<script setup lang="ts" generic="Instruction extends ProgramInstruction">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { ChevronRight, Lock, Trash2 } from '@lucide/vue';
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
import { usePreferences } from '@/ui/usePreferences';
import { lineMoveOf, rowAfterRemove } from '@/ui/programKeys';
import { canMove, moveRefusal } from '@/ui/programLock';
import type { ProgramSource } from '@/ui/useProgramLines';
import ProgramLineActions from './ProgramLineActions.vue';

const props = withDefaults(
  defineProps<{
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
    /** The example the program was loaded from, while it is still that program. */
    source?: ProgramSource | null;
    /** The line being edited in the builder, if one is. */
    editingLine?: number | null;
    /** True when lines were moved under a program that has already run. */
    stale?: boolean;
    /** The last move of a line, from here or from the command palette, to be announced. */
    lastMove?: { from: number; to: number } | null;
    /** Lines at the top that are given by a challenge: shown, and not edited, moved or deleted. */
    locked?: number;
  }>(),
  { source: null, editingLine: null, lastMove: null, locked: 0 }
);

const emit = defineEmits<{
  clear: [];
  remove: [index: number];
  /** Asks for a line to be loaded into the builder, which will replace it. */
  edit: [index: number];
  /** Asks for the line at `from` to be moved to `to`. */
  move: [from: number, to: number];
  /** Asks for the CPU to be reset, from the notice of a program edited while running. */
  reset: [];
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

const { calm } = usePreferences();

function placeMarker(): void {
  const lines = list.value;
  const row = lines?.querySelector<HTMLElement>(
    `[data-row="${props.finished ? 'end' : props.ip}"]`
  );
  // A row with no height is a panel out of sight (another view of a phone): no marker to draw.
  if (!lines || !row || row.offsetHeight === 0) {
    marker.value = null;
    return;
  }
  marker.value = { top: row.offsetTop, height: row.offsetHeight };

  const bottom = row.offsetTop + row.offsetHeight;
  // With fewer animations asked for, the list jumps to the line instead of sliding there.
  const behavior = calm.value ? 'auto' : 'smooth';
  if (row.offsetTop < lines.scrollTop) {
    lines.scrollTo({ top: row.offsetTop - 4, behavior });
  } else if (bottom > lines.scrollTop + lines.clientHeight) {
    lines.scrollTo({ top: bottom - lines.clientHeight + 4, behavior });
  }
}

onMounted(placeMarker);
// A phone's view coming back into sight gives the rows their height again.
useResizeObserver(list, placeMarker);
watch(() => [props.ip, props.finished, props.program, props.insertAt], placeMarker, {
  flush: 'post'
});

/**
 * The last move in words, or why one was refused, for a screen reader: the focus alone does not
 * say a line moved, and a refused move changes nothing at all.
 */
const moved = ref('');

// Emptied first and filled a tick later: a live region stays silent when its text is set to
// what it already says, as it would be for the same move made twice.
function announce(text: string | null): void {
  moved.value = '';
  if (text === null) return;
  void nextTick(() => {
    moved.value = text;
  });
}

watch(
  () => props.lastMove,
  (lastMove) =>
    announce(lastMove ? `${formatLabel(lastMove.from)} moved to ${formatLabel(lastMove.to)}` : null)
);

/**
 * Moves a line and takes the focus along. The rows are redrawn in place, so the control that
 * was focused now belongs to another line: the same control of the moved line is focused.
 */
function move(from: number, to: number, action: string): void {
  emit('move', from, to);
  void nextTick(() => {
    const row = list.value?.querySelector<HTMLElement>(`[data-row="${to}"]`);
    // The menu button is in every row at every width; the others are not.
    const control =
      row?.querySelector<HTMLElement>(`[data-action="${action}"]`) ??
      row?.querySelector<HTMLElement>('[data-action="more"]');
    control?.focus();
  });
}

/**
 * Removes a line. Its buttons go with it, so the focus goes to the same place in the line that
 * takes its place, or the line above when it was the last; with no line left, to the list.
 */
function remove(index: number): void {
  const removedFrom = list.value?.contains(document.activeElement) ?? false;
  emit('remove', index);
  if (!removedFrom) return;
  void nextTick(() => {
    const at = rowAfterRemove(index, props.program.length);
    const row = list.value?.querySelector<HTMLElement>(`[data-row="${at}"]`);
    const control = row?.querySelector<HTMLElement>('[data-action="more"]');
    (control ?? list.value)?.focus();
  });
}

/** Alt with Up or Down moves the line whose control has the focus. */
function onListKeydown(event: KeyboardEvent): void {
  if (!(event.target instanceof HTMLElement)) return;
  const row = Number(event.target.closest<HTMLElement>('li[data-row]')?.dataset.row);
  const change = lineMoveOf(event, row, props.program.length);
  if (!change) return;
  event.preventDefault();
  // A given line stays where it is, and nothing moves in above it. The program itself would
  // refuse the move too: asking here keeps the focus where it is, and says why.
  if (!canMove(change.from, change.to, props.locked)) {
    announce(moveRefusal(change.from, props.locked));
    return;
  }
  // Caught on the way down and stopped: on the menu button, Arrow Down would open the menu too.
  event.stopPropagation();
  const control = event.target.closest<HTMLElement>('[data-action]');
  move(change.from, change.to, control?.dataset.action ?? 'more');
}

const ROW =
  'group relative col-span-full grid h-7 pointer-coarse:h-auto pointer-coarse:min-h-11 grid-cols-subgrid items-center pr-1 pl-2';

function machineCode(index: number): string {
  return formatBytes(props.code[index].bytes);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle role="heading" aria-level="2">Program</CardTitle>
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
              class="pointer-coarse:size-11 max-md:relative max-md:-mr-0.5 max-md:size-5 max-md:pointer-coarse:size-5 max-md:pointer-coarse:after:absolute max-md:pointer-coarse:after:-inset-3 max-md:pointer-coarse:after:content-['']"
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
      <!-- What the lines below are for: without it a loaded example is only code. -->
      <p v-if="source" class="mb-2 px-3.5 text-xs leading-4 text-muted-foreground">
        <span class="font-medium text-foreground">{{ source.name }}</span>
        · {{ source.description }}
      </p>
      <!-- The stack and the registers still hold places from before the edit: say so once. -->
      <!-- The region is there before its text: a status that arrives whole is often not read. -->
      <div role="status">
        <p v-if="stale" class="mb-2 px-3.5 text-xs leading-4 text-muted-foreground">
          Edited after it started running: a return address the CPU already holds may now point at
          another line.
          <Button
            variant="link"
            size="sm"
            class="relative h-auto border-0 p-0 text-xs pointer-coarse:after:absolute pointer-coarse:after:-inset-3.5 pointer-coarse:after:content-['']"
            @click="emit('reset')"
            >Reset</Button
          >
          to run it from the start.
        </p>
      </div>
      <p class="sr-only" aria-live="polite">{{ moved }}</p>
      <!--
        The instruction's column takes the width of its lines, up to 28 characters: a longer line is
        cut (its title gives it whole), so one long line does not push every line's bytes out. A
        narrow panel drops the bytes, which have a panel of their own, before it cuts a line.
      -->
      <ol
        ref="list"
        tabindex="-1"
        data-fill
        class="well relative grid max-h-80 grid-cols-[1.25rem_2.75rem_fit-content(28ch)_minmax(0,1fr)_auto] content-start gap-x-1 overflow-y-auto rounded-lg py-1 font-mono text-code lg:max-h-112"
        aria-label="Program lines"
        @keydown.capture="onListKeydown"
      >
        <li
          v-if="marker"
          class="ip-marker pointer-events-none absolute inset-x-0 top-0 flex items-center pl-2 transition-[translate,height] duration-300 ease-out calm:transition-none"
          :style="{ translate: `0 ${marker.top}px`, height: `${marker.height}px` }"
          aria-hidden="true"
        >
          <ChevronRight class="size-4 text-pointer" />
        </li>
        <template v-for="(instruction, index) in program" :key="index">
          <li v-if="insertionPoint === index && insertAt !== null" class="col-span-full px-2">
            <button
              type="button"
              class="flex w-full items-center gap-2 py-0.5 font-sans text-xs pointer-coarse:min-h-11 text-muted-foreground hover:text-foreground"
              @click="emit('update:insertAt', null)"
            >
              <span class="h-px flex-1 border-t border-dashed border-foreground/40" />
              new lines go here ·
              <span class="underline underline-offset-2">add at the end instead</span>
            </button>
          </li>
          <li
            :class="[
              ROW,
              ip === index ? '' : 'hover:bg-muted/60',
              { 'inset-ring inset-ring-foreground/40': editingLine === index }
            ]"
            :data-row="index"
            :aria-current="ip === index ? 'step' : undefined"
          >
            <!-- The line that ran last, unless the IP marker already sits on it. -->
            <span class="flex justify-center" aria-hidden="true">
              <span
                v-if="lastLine === index && ip !== index"
                class="size-1.5 rounded-full bg-muted-foreground"
                title="Ran last"
              />
            </span>
            <span
              class="text-xs"
              :class="
                targets.has(index) ? 'font-semibold text-foreground' : 'text-muted-foreground'
              "
              >{{ formatLabel(index) }}{{ targets.has(index) ? ':' : '' }}</span
            >
            <!-- A finger cannot hover for the title: on a touch screen a long line wraps instead. -->
            <span
              class="truncate pointer-coarse:whitespace-normal pointer-coarse:break-words"
              :class="{ 'font-semibold': lastLine === index }"
              :title="format(instruction)"
              ><span :data-loc="`line:${index}`">{{ format(instruction) }}</span></span
            >
            <!-- Whole or not at all: the cell is measured, and bytes it cannot fit are not drawn. -->
            <span v-if="code[index]" class="line-code" :data-bytes="code[index].bytes.length">
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    data-action="code"
                    class="rounded-sm pr-1 pl-3 text-left text-xs whitespace-nowrap pointer-coarse:leading-11 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    :class="code[index].problem ? 'text-destructive' : 'text-muted-foreground'"
                    :aria-label="
                      code[index].problem
                        ? `Take apart ${machineCode(index)}: ${code[index].problem}`
                        : `Take apart the machine code of ${formatLabel(index)}, ${machineCode(index)}`
                    "
                    @click="emit('inspect', index)"
                  >
                    {{ machineCode(index) }}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <template v-if="code[index].problem">{{ code[index].problem }} </template>
                  Machine code at {{ codePlace(code[index].address) }}. Click to take it apart.
                </TooltipContent>
              </Tooltip>
            </span>
            <span v-else />
            <!-- Placed by name: on a phone the machine code is not drawn, and takes no column. -->
            <span
              v-if="index < locked"
              class="col-start-5 flex size-6 items-center justify-center justify-self-end text-muted-foreground pointer-coarse:size-11"
              title="Given by the challenge: it stays as it is"
            >
              <Lock class="size-3.5" aria-hidden="true" />
              <span class="sr-only">Locked</span>
            </span>
            <!--
              With a mouse the buttons show only on hover, so they take no column: they sit over
              the line's end, and the line keeps its whole width. On a touch screen they stay.
            -->
            <ProgramLineActions
              v-else
              class="col-start-5 justify-self-end pointer-fine:absolute pointer-fine:inset-y-0 pointer-fine:right-1 pointer-fine:items-center pointer-fine:rounded-sm pointer-fine:bg-inset"
              :label="formatLabel(index)"
              :can-move-up="index > locked"
              :can-move-down="index < program.length - 1"
              :can-inspect="!!code[index]"
              @edit="emit('edit', index)"
              @move-up="move(index, index - 1, 'more')"
              @move-down="move(index, index + 1, 'more')"
              @insert-above="emit('update:insertAt', index)"
              @inspect="emit('inspect', index)"
              @remove="remove(index)"
            />
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
        Build an instruction and
        <span class="pointer-coarse:hidden">
          press <KbdGroup><Kbd>⇧</Kbd><Kbd>Enter</Kbd></KbdGroup>
        </span>
        <!-- A touch screen has no Shift+Enter: the button under the builder adds the line. -->
        <span class="hidden pointer-coarse:inline">
          tap <span class="font-medium text-foreground">Add at {{ formatLabel(0) }}</span>
        </span>
        to add it as a line, or
        <Button
          variant="link"
          size="sm"
          class="relative h-auto border-0 p-0 pointer-coarse:after:absolute pointer-coarse:after:-inset-3.5 pointer-coarse:after:content-['']"
          @click="emit('examples')"
          >start from an example</Button
        >.
      </p>
    </CardContent>
  </Card>
</template>
