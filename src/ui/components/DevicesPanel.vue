<script setup lang="ts">
import { computed } from 'vue';
import { DIGIT_COUNT, PORTS, litSegments, terminalText } from '@/core/shared/devices';
import { formatHex } from '@/core/shared/numbers';
import type { CpuState } from '@/core/shared/state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeviceAccess } from '@/ui/deviceAccess';
import { sound } from '@/ui/soundEngine';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import InfoTip from './InfoTip.vue';

const props = defineProps<{
  state: CpuState;
  /** How the CPU reaches the devices, which the labels show. */
  access: DeviceAccess;
}>();

const emit = defineEmits<{
  /** A device changed the byte it presents on an input port. */
  input: [port: number, value: number];
}>();

/** Most significant bit first, the way a byte is written. */
const BITS = [7, 6, 5, 4, 3, 2, 1, 0];

// Reading ioVersion makes these re-run after port changes: the byte arrays are not reactive.
function latched(port: number): number {
  void props.state.ioVersion;
  return props.state.io.out[port];
}

const leds = computed(() => latched(PORTS.leds));

const switches = computed(() => {
  void props.state.ioVersion;
  return props.state.io.in[PORTS.switches];
});

const digits = computed(() =>
  Array.from({ length: DIGIT_COUNT }, (_, index) => {
    const port = PORTS.digits + index;
    const value = latched(port);
    return { port, value, lit: new Set<string>(litSegments(value)) };
  })
);

const terminal = computed(() => terminalText(props.state.io.terminal));

function isOn(value: number, bit: number): boolean {
  return (value & (1 << bit)) !== 0;
}

function port(number: number): string {
  return props.access.address(number);
}

function flip(bit: number): void {
  sound.play(isOn(switches.value, bit) ? 'switch-off' : 'switch-on');
  emit('input', PORTS.switches, switches.value ^ (1 << bit));
}
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="flex items-center gap-1 group-data-[size=sm]/card:text-base">
        I/O devices
        <InfoTip label="About the devices">
          <span class="font-mono">{{ access.write }}</span> writes to a {{ access.noun }},
          <span class="font-mono">{{ access.read }}</span> reads one.
        </InfoTip>
      </CardTitle>
    </CardHeader>

    <!--
      On a phone: the LEDs over the switches, each bit over its own, then the digits beside the
      terminal, at the same height.
    -->
    <CardContent
      class="grid gap-x-6 gap-y-4 max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:gap-x-4 sm:grid-cols-[auto_auto_minmax(0,1fr)]"
    >
      <div class="flex flex-col gap-3.5 max-sm:contents">
        <section class="max-sm:order-1 max-sm:col-span-2" aria-label="LEDs">
          <h3 class="device-title">
            LEDs
            <span class="device-port"
              >{{ access.write }} {{ port(PORTS.leds) }} = {{ formatHex(leds, 8) }}h</span
            >
          </h3>
          <div
            class="flex gap-1.5 max-sm:grid max-sm:grid-cols-8 max-sm:justify-items-center max-sm:gap-0"
          >
            <span
              v-for="bit in BITS"
              :key="bit"
              class="device-led"
              :class="{ 'device-lit': isOn(leds, bit) }"
              :title="`Bit ${bit}`"
              role="img"
              :aria-label="`LED ${bit} is ${isOn(leds, bit) ? 'on' : 'off'}`"
            />
          </div>
        </section>

        <section class="max-sm:order-2 max-sm:col-span-2" aria-label="Switches">
          <h3 class="device-title">
            Switches
            <span class="device-port"
              >{{ access.read }} {{ port(PORTS.switches) }} = {{ formatHex(switches, 8) }}h</span
            >
          </h3>
          <div
            class="flex gap-1.5 pointer-coarse:gap-5 max-sm:grid max-sm:grid-cols-8 max-sm:justify-items-center max-sm:gap-0 max-sm:pointer-coarse:gap-0"
          >
            <Tooltip v-for="bit in BITS" :key="bit">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="device-switch"
                  :class="{ 'device-switch-on': isOn(switches, bit) }"
                  :aria-pressed="isOn(switches, bit)"
                  :aria-label="`Switch ${bit}`"
                  @click="flip(bit)"
                >
                  <span class="device-knob" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Bit {{ bit }}</TooltipContent>
            </Tooltip>
          </div>
        </section>
      </div>

      <section class="max-sm:order-3" aria-label="7-segment display">
        <!-- On a phone its column is narrow: the port goes under the name, as the terminal's does. -->
        <h3 class="device-title max-sm:flex-col max-sm:items-start">
          7-segment
          <span class="device-port"
            >{{ access.write }} {{ port(PORTS.digits) }}, {{ port(PORTS.digits + 1) }}</span
          >
        </h3>
        <div
          class="device-screen flex items-center gap-2.5 px-3.5 py-3 max-sm:gap-2 max-sm:px-3 max-sm:py-2.5 sm:h-24"
        >
          <svg
            v-for="digit in digits"
            :key="digit.port"
            viewBox="0 0 42 64"
            class="h-16 w-auto max-sm:h-12"
            role="img"
            :aria-label="`Digit at ${access.noun} ${port(digit.port)} shows ${formatHex(digit.value, 8)}h`"
          >
            <title>
              {{ formatHex(digit.value, 8) }}h, written to {{ access.noun }} {{ port(digit.port) }}.
              Bits 0 to 7 light a, b, c, d, e, f, g and the dot.
            </title>
            <g class="device-segments">
              <rect
                :class="{ 'device-lit': digit.lit.has('a') }"
                x="9"
                y="3"
                width="18"
                height="5"
              />
              <rect
                :class="{ 'device-lit': digit.lit.has('b') }"
                x="28"
                y="8"
                width="5"
                height="21"
              />
              <rect
                :class="{ 'device-lit': digit.lit.has('c') }"
                x="28"
                y="35"
                width="5"
                height="21"
              />
              <rect
                :class="{ 'device-lit': digit.lit.has('d') }"
                x="9"
                y="56"
                width="18"
                height="5"
              />
              <rect
                :class="{ 'device-lit': digit.lit.has('e') }"
                x="3"
                y="35"
                width="5"
                height="21"
              />
              <rect
                :class="{ 'device-lit': digit.lit.has('f') }"
                x="3"
                y="8"
                width="5"
                height="21"
              />
              <rect
                :class="{ 'device-lit': digit.lit.has('g') }"
                x="9"
                y="29.5"
                width="18"
                height="5"
              />
              <circle :class="{ 'device-lit': digit.lit.has('dp') }" cx="38" cy="58.5" r="2.5" />
            </g>
          </svg>
        </div>
      </section>

      <section class="flex min-w-0 flex-col max-sm:order-4" aria-label="Terminal">
        <h3 class="device-title max-sm:flex-col max-sm:items-start">
          Terminal
          <span class="device-port">{{ access.write }} {{ port(PORTS.terminal) }}</span>
        </h3>
        <!--
          Reversed, so the newest output stays in view as the text grows; the margin keeps a short
          text at the top, where a terminal starts printing.
        -->
        <div
          class="device-screen flex h-24 flex-col-reverse overflow-y-auto px-3 py-2.5 max-sm:h-[4.375rem] [--scrollbar-thumb-hover:var(--screen-scrollbar)] [--scrollbar-thumb:var(--screen-scrollbar)]"
        >
          <pre
            v-if="terminal"
            class="mb-auto font-mono text-code leading-5 break-all whitespace-pre-wrap"
            aria-live="polite">{{ terminal }}<span class="device-caret" aria-hidden="true" /></pre>
          <p
            v-else
            class="mb-auto flex gap-2 text-xs leading-5 text-(--screen-foreground)/70 max-sm:leading-4"
          >
            <!-- Beside the text, not in it: a second line starts under the first, not the cursor. -->
            <span class="device-caret mt-0.5 shrink-0" aria-hidden="true" />
            <span>Each byte written here is printed as a character.</span>
          </p>
        </div>
      </section>
    </CardContent>
  </Card>
</template>
