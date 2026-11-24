import { ref, shallowRef } from 'vue';
import { settle } from '@/core/logic/feedback';
import type { Bit, Signals } from '@/core/logic/gates';
import { holding } from '@/core/logic/register';
import { SEQUENCE } from '@/core/logic/sequence';
import {
  SEQUENCE_CIRCUITS,
  SEQUENCE_INPUT,
  SEQUENCE_WIDTH,
  type SequenceId
} from './storageSequence';
import { recorded, type Sample } from './storageTiming';

/**
 * The flip-flops that feed one another, worked by hand: which circuit is on show, the values on
 * its inputs and what its flip-flops hold, since each change starts from the last one.
 */
export function useStorageSequence() {
  const kind = ref<SequenceId>('shift');
  const inputs = shallowRef<Record<string, Bit>>({});
  const signals = shallowRef<Signals>({});
  /** The circuit after each change made by hand, the newest last, for the timing diagram. */
  const trace = shallowRef<Sample[]>([]);
  /** How many samples the last press added: a pulse adds two. */
  const pressSteps = ref(1);
  /** How many times the clock was pulsed since the circuit started over. */
  const ticks = ref(0);

  function apply(next: Record<string, Bit>, held: Signals): void {
    const state = settle(SEQUENCE_CIRCUITS[kind.value], next, held);
    inputs.value = next;
    signals.value = state.signals;
    trace.value = recorded(trace.value, state);
    pressSteps.value = 1;
  }

  /** Every flip-flop back at 0, the inputs at 0, and the timing diagram empty. */
  function reset(): void {
    trace.value = [];
    ticks.value = 0;
    apply(
      { [SEQUENCE.clock]: 0, [SEQUENCE_INPUT[kind.value].signal]: 0 },
      holding(SEQUENCE_WIDTH, 0)
    );
  }

  function pick(next: SequenceId): void {
    kind.value = next;
    reset();
  }

  function flip(signal: string): void {
    apply({ ...inputs.value, [signal]: (inputs.value[signal] ^ 1) as Bit }, signals.value);
  }

  /** Flips the circuit's own input: the bit that comes in, or whether it counts. */
  function flipInput(): void {
    flip(SEQUENCE_INPUT[kind.value].signal);
  }

  /** Raises the clock and lowers it: one tick in one press. */
  function pulse(): void {
    flip(SEQUENCE.clock);
    flip(SEQUENCE.clock);
    pressSteps.value = 2;
    ticks.value += 1;
  }

  reset();

  return { kind, inputs, signals, trace, pressSteps, ticks, pick, flipInput, pulse, reset };
}

/** The flip-flops that feed one another, as their panel receives them. */
export type StorageSequence = ReturnType<typeof useStorageSequence>;
