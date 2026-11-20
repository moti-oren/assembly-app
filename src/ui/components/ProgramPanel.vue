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
  'group col-span-full grid h-7 pointer-coarse:h-11 grid-cols-subgrid items-center pr-1 pl-2';

function machineCode(index: number): string {
  return formatBytes(props.code[index].bytes);
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
      <ol
        ref="list"
        data-fill
        class="well relative grid max-h-80 grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_auto_auto] content-start gap-x-1 overflow-y-auto rounded-lg py-1 font-mono text-code lg:max-h-112"
        aria-label="Program lines"
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
            :class="[ROW, ip === index ? '' : 'hover:bg-muted/60']"
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
            <span class="truncate" :class="{ 'font-semibold': lastLine === index }"
              ><span :data-loc="`line:${index}`">{{ format(instruction) }}</span></span
            >
            <Tooltip v-if="code[index]">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="hidden max-w-36 justify-self-start truncate rounded-sm px-1 text-left text-xs pointer-coarse:self-stretch pointer-coarse:leading-11 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:block"
                  :class="{ 'text-destructive': code[index].problem }"
                  @click="emit('inspect', index)"
                >
                  {{ machineCode(index) }}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Machine code at {{ codePlace(code[index].address) }}. Click to take it apart.
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
                    aria-label="Insert new lines above this one"
                    @click="emit('update:insertAt', index)"
                  >
                    <ArrowUpToLine />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert new lines above this one</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="hover:text-destructive pointer-coarse:size-11"
                    aria-label="Delete this line"
                    @click="emit('remove', index)"
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete this line</TooltipContent>
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
