import {
  computed,
  Fragment,
  h,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  type Ref,
  type Slot,
  type VNode
} from 'vue';
import { createGlobalState } from '@vueuse/core';

/**
 * The places of the shell a page fills: the header's buttons (`actions`), the rows of the menu
 * below a desktop (`menuActions`, then `menu` under them), the strip under the header below a
 * desktop, and what is under the panes (`above` the bottom bar, then the `bar` itself).
 */
export type ShellPart = 'actions' | 'menuActions' | 'menu' | 'strip' | 'above' | 'bar';

/** What the page on show hands the shell. */
export interface ShellFilling {
  slots: Partial<Record<ShellPart, Slot>>;
  /** The header's one menu below a desktop, which the page can also open. */
  menuOpen: Ref<boolean>;
  /** The header's Commands button was pressed: the page opens its palette. */
  commands: () => void;
}

/** How long a press of Commands waits for a page on its way. */
const COMMANDS_WAIT_MS = 2000;

/** Each page's key in the shell, so another page's parts are mounted anew. */
const pageKeys = new WeakMap<ShellFilling, number>();
let nextKey = 0;

const useShellStore = createGlobalState(() => {
  const filling = shallowRef<ShellFilling | null>(null);
  /** Raised when the page's slots changed without anything reactive in them changing. */
  const version = ref(0);
  /** The menu's state while no page fills the shell, as while one is loading. */
  const idleMenu = ref(false);
  /**
   * When Commands was pressed while no page filled the shell: the next page opens its palette,
   * if it comes soon enough to read as the answer to that press.
   */
  let commandsAskedAt: number | null = null;
  function takeWaitingCommands(): boolean {
    const asked = commandsAskedAt !== null && Date.now() - commandsAskedAt < COMMANDS_WAIT_MS;
    commandsAskedAt = null;
    return asked;
  }
  function waitForCommands(): void {
    commandsAskedAt = Date.now();
  }
  return { filling, version, idleMenu, takeWaitingCommands, waitForCommands };
});

/**
 * The shell's side: the header, the strip and the bar stay mounted for the whole visit, and show
 * what the page on show put in them. Until a page has filled them (its chunk is on its way)
 * each place shows what stands in for it.
 */
export function useShellParts() {
  const { filling, version, idleMenu, waitForCommands } = useShellStore();

  /** Whether a page fills the shell. */
  const filled = computed(() => filling.value !== null);

  const menuOpen = computed({
    get: () => (filling.value ? filling.value.menuOpen.value : idleMenu.value),
    set: (open: boolean) => {
      if (filling.value) filling.value.menuOpen.value = open;
      else idleMenu.value = open;
    }
  });

  /**
   * What the page puts in a place, keyed by the page, so another page's part is mounted anew
   * rather than patched from the last one's.
   */
  function render(part: ShellPart): VNode | null {
    void version.value;
    const now = filling.value;
    const slot = now?.slots[part];
    return now && slot ? h(Fragment, { key: pageKeys.get(now) }, slot()) : null;
  }

  function commands(): void {
    if (filling.value) filling.value.commands();
    else waitForCommands();
  }

  return { filled, menuOpen, render, commands };
}

/**
 * The page's side: while the page is on show its parts are the shell's. A page kept alive out of
 * sight gives them back, so only the page on show is ever drawn into the shell.
 */
export function useShellFill(filling: ShellFilling): void {
  const store = useShellStore();
  pageKeys.set(filling, nextKey++);

  function fill(): void {
    store.filling.value = filling;
    if (store.takeWaitingCommands()) filling.commands();
  }
  function release(): void {
    if (store.filling.value === filling) store.filling.value = null;
  }

  onMounted(fill);
  onActivated(fill);
  onDeactivated(release);
  onBeforeUnmount(release);
  // A slot that came or went (a `v-if` on a slot) changes nothing reactive the shell reads.
  onUpdated(() => {
    if (store.filling.value === filling) store.version.value++;
  });
}
