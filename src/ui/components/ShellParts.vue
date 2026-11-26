<script lang="ts">
import { computed, defineComponent, type PropType, type Slot, type SlotsType } from 'vue';
import { useShellFill, type ShellPart } from '@/ui/useShellParts';
import { useVModel } from '@vueuse/core';

/**
 * A page's parts of the shell, each in the slot of its place (`useShellParts.ts`): the shell in
 * App.vue draws them while the page is on show. It draws nothing where it stands.
 */
export default defineComponent({
  props: {
    /** The header's one menu below a desktop, which the page can also open. */
    menuOpen: { type: Boolean as PropType<boolean>, default: undefined }
  },
  emits: ['update:menuOpen', 'commands'],
  slots: Object as SlotsType<Partial<Record<ShellPart, () => unknown>>>,
  setup(props, { emit, slots }) {
    const menuOpen = useVModel(props, 'menuOpen', emit, { passive: true, defaultValue: false });
    useShellFill({
      slots: slots as Partial<Record<ShellPart, Slot>>,
      menuOpen: computed({
        get: () => menuOpen.value ?? false,
        set: (open: boolean) => (menuOpen.value = open)
      }),
      commands: () => emit('commands')
    });
    return () => null;
  }
});
</script>
