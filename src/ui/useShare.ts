import { createGlobalState } from '@vueuse/core';
import { useLazyOpen } from './useLazyOpen';

/** Whether the share dialog is open; the header and the palette both open it. */
export const useShare = createGlobalState(useLazyOpen);
