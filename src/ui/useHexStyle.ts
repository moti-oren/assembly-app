import { computed, type ComputedRef } from 'vue';
import { HEX_STYLES, type HexStyle } from './hexNotation';
import { usePreferences } from './usePreferences';

/** How the CPU chosen in the header writes hex, which a topic's page follows. */
export function useHexStyle(): ComputedRef<HexStyle> {
  const { architecture } = usePreferences();
  return computed(() => HEX_STYLES[architecture.value]);
}
