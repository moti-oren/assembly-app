<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { bitsAt, WHEEL_RADIUS, WHEEL_SIZE, type Wheel } from '@/ui/numbersWheel';

const props = defineProps<{
  wheel: Wheel;
  width: number;
  /** A's bits, which the handle on the ring sets. */
  a: number;
  /** A's value on this wheel's scale, as a screen reader hears it. */
  reading: string;
  /** Whether the CPU wrote the result on show. */
  written: boolean;
  /** When it changes, the journey is drawn again from A (`journeyKey` of numbersWheel.ts). */
  journeyKey: string;
}>();
const emit = defineEmits<{ set: [bits: number] }>();

const drawing = useTemplateRef<SVGSVGElement>('drawing');

/** Where the drawing is on the screen, measured once as a drag begins, not on every move. */
let box: DOMRect | null = null;

/** Follows a finger or the mouse round the ring. */
function drag(event: PointerEvent): void {
  if (!box || !(event.buttons & 1)) return;
  const scale = WHEEL_SIZE / box.width;
  const bits = bitsAt(
    { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale },
    props.width
  );
  if (bits !== props.a) emit('set', bits);
}

function grab(event: PointerEvent): void {
  box = drawing.value?.getBoundingClientRect() ?? null;
  if (event.currentTarget instanceof Element)
    event.currentTarget.setPointerCapture(event.pointerId);
}

const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 16,
  PageDown: -16
};

function nudge(event: KeyboardEvent): void {
  const ends: Record<string, number> = { Home: 0, End: 2 ** props.width - 1 };
  const to = ends[event.key] ?? (event.key in STEPS ? props.a + STEPS[event.key] : null);
  if (to === null) return;
  event.preventDefault();
  emit('set', to);
}
</script>

<!--
  Every value of the width on a ring, and the operation as a journey round it from A. The seam is
  where this scale ends and starts again: a journey over it is an answer that did not fit.
-->
<template>
  <svg
    ref="drawing"
    class="numbers-wheel"
    :viewBox="`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`"
    role="group"
    :aria-label="`The ${wheel.scale} wheel`"
  >
    <!-- The drawing is told in the text under it: only the handle is in the reading order. -->
    <g aria-hidden="true">
      <circle class="wheel-ring" :cx="WHEEL_SIZE / 2" :cy="WHEEL_SIZE / 2" :r="WHEEL_RADIUS" />
      <line
        class="wheel-seam"
        :data-crossed="wheel.seam.crossed ? '' : undefined"
        :x1="wheel.seam.from.x"
        :y1="wheel.seam.from.y"
        :x2="wheel.seam.to.x"
        :y2="wheel.seam.to.y"
      />
      <text
        v-for="mark in wheel.marks"
        :key="mark.label"
        class="wheel-mark"
        :x="mark.x"
        :y="mark.y"
        :text-anchor="mark.anchor"
      >
        {{ mark.label }}
      </text>
      <g v-if="wheel.path" :key="journeyKey">
        <path class="wheel-journey" :d="wheel.path" pathLength="1" />
        <polygon class="wheel-head" :points="wheel.head" />
      </g>
      <circle
        class="wheel-end"
        :data-written="written ? '' : undefined"
        :cx="wheel.end.x"
        :cy="wheel.end.y"
        r="5"
      />
    </g>
    <!-- The handle answers a press anywhere in the clear circle round it, which a finger can hit. -->
    <g
      class="wheel-handle"
      tabindex="0"
      role="slider"
      :aria-label="`A on the ${wheel.scale} wheel`"
      :aria-valuetext="reading"
      :aria-valuenow="a"
      aria-valuemin="0"
      :aria-valuemax="2 ** width - 1"
      @keydown="nudge"
      @pointerdown="grab"
      @pointermove="drag"
    >
      <circle class="wheel-reach" :cx="wheel.start.x" :cy="wheel.start.y" r="18" />
      <circle class="wheel-start" :cx="wheel.start.x" :cy="wheel.start.y" r="6.5" />
    </g>
  </svg>
</template>
