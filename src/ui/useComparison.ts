import { createGlobalState } from '@vueuse/core';
import { useLazyOpen } from './useLazyOpen';

/** Whether the comparison of the three CPUs is open; the header and the palette both open it. */
export const useComparison = createGlobalState(useLazyOpen);
