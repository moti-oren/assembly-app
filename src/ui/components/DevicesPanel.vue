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

    <CardContent class="grid gap-x-6 gap-y-4 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
      <div class="flex flex-col gap-3">
        <section aria-label="LEDs">
          <h3 class="device-title">
            LEDs
            <span class="device-port"
              >{{ access.write }} {{ port(PORTS.leds) }} = {{ formatHex(leds, 8) }}h</span
            >
          </h3>
          <div class="flex gap-1.5">
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

        <section aria-label="Switches">
          <h3 class="device-title">
            Switches
            <span class="device-port"
              >{{ access.read }} {{ port(PORTS.switches) }} = {{ formatHex(switches, 8) }}h</span
            >
          </h3>
          <div class="flex gap-1.5 pointer-coarse:gap-5">
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

      <section aria-label="7-segment display">
        <h3 class="device-title">
          7-segment
          <span class="device-port"
            >{{ access.write }} {{ port(PORTS.digits) }}, {{ port(PORTS.digits + 1) }}</span
          >
        </h3>
        <div class="device-screen flex gap-2.5 px-3.5 py-3">
          <svg
            v-for="digit in digits"
            :key="digit.port"
            viewBox="0 0 42 64"
            class="h-16 w-auto"
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

      <section class="flex min-w-0 flex-col" aria-label="Terminal">
        <h3 class="device-title">
          Terminal
          <span class="device-port">{{ access.write }} {{ port(PORTS.terminal) }}</span>
        </h3>
        <!--
          Reversed, so the newest output stays in view as the text grows; the margin keeps a short
          text at the top, where a terminal starts printing.
        -->
        <div
          class="device-screen flex h-24 flex-col-reverse overflow-y-auto px-3 py-2.5 [scrollbar-color:oklch(1_0_0/30%)_transparent]"
        >
          <pre
            v-if="terminal"
            class="mb-auto font-mono text-code leading-5 break-all whitespace-pre-wrap"
            aria-live="polite">{{ terminal }}<span class="device-caret" aria-hidden="true" /></pre>
          <p v-else class="mb-auto text-xs leading-5 text-(--screen-foreground)/70">
            <span class="device-caret mr-2" aria-hidden="true" />Each byte written here is printed
            as a character.
          </p>
        </div>
      </section>
    </CardContent>
  </Card>
</template>
