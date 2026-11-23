import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { PREDICTORS, type PredictorKind } from '@/core/rv32/branchPredictor';
import { PREDICTOR_COMMANDS } from './rv32Pipeline';
import { STORAGE_KEYS } from './storageKeys';
import type { PaletteCommand } from './paletteCommand';

/** Anything else in storage is the predictor the chart always had. */
function readPredictor(raw: string): PredictorKind {
  return PREDICTORS.find((kind) => kind === raw) ?? 'not-taken';
}

/**
 * How RISC-V's cycle card shows the instructions: one at a time, or overlapped in the five-stage
 * pipeline, with or without forwarding and with one of the branch predictors. All are remembered.
 */
export const useRv32Pipeline = createGlobalState(() => {
  const shown = useLocalStorage(STORAGE_KEYS.rv32Pipeline, false);
  const forwarding = useLocalStorage(STORAGE_KEYS.rv32Forwarding, true);
  const predictor = useLocalStorage<PredictorKind>(STORAGE_KEYS.rv32Predictor, 'not-taken', {
    serializer: { read: readPredictor, write: (kind) => kind }
  });

  /** The palette's commands for all three, labelled for their current state. */
  function commands(): PaletteCommand[] {
    return [
      {
        group: 'CPU',
        label: shown.value ? 'Hide the pipeline' : 'Show the pipeline',
        run: () => {
          shown.value = !shown.value;
        }
      },
      {
        group: 'CPU',
        label: forwarding.value
          ? 'Turn forwarding off in the pipeline'
          : 'Turn forwarding on in the pipeline',
        run: () => {
          forwarding.value = !forwarding.value;
        }
      },
      ...PREDICTORS.filter((kind) => kind !== predictor.value).map((kind) => ({
        group: 'CPU',
        label: PREDICTOR_COMMANDS[kind],
        run: () => {
          predictor.value = kind;
        }
      }))
    ];
  }

  return { shown, forwarding, predictor, commands };
});
