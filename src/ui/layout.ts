import { createSharedComposable, useMediaQuery } from '@vueuse/core';

/** Tailwind's `lg` breakpoint, where App.vue splits the page into two columns. */
const TWO_COLUMNS_QUERY = '(min-width: 64rem)';

/** True while the page shows two columns side by side. */
export const useTwoColumns = createSharedComposable(() => useMediaQuery(TWO_COLUMNS_QUERY));
