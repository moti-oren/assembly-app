import { nextTick, type Ref } from 'vue';
import { boxMove } from './builderKeys';
import { rowNeighbour } from './gridNavigation';

/** What the arrow keys move through: the options of the builder, in the order they are shown. */
interface OptionList {
  /** The card the options are drawn in; each option is marked `data-option`. */
  card: () => HTMLElement | null;
  count: () => number;
  /** False when no option is on offer to move to. */
  active: () => boolean;
  selectedIndex: Ref<number>;
}

/** Left and Right walk the options one at a time, Up and Down by row as they are laid out. */
export function useOptionArrows(list: OptionList) {
  return (event: KeyboardEvent): void => {
    const count = list.count();
    if (!list.active() || count === 0) return;
    event.preventDefault();
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const card = list.card();
    if (vertical) {
      const buttons = [...(card?.querySelectorAll<HTMLElement>('[data-option]') ?? [])];
      if (buttons.length === count) {
        const boxes = buttons.map((button) => button.getBoundingClientRect());
        list.selectedIndex.value = rowNeighbour(boxes, list.selectedIndex.value, forward);
      }
    } else {
      list.selectedIndex.value = (list.selectedIndex.value + (forward ? 1 : -1) + count) % count;
    }
    void nextTick(() => {
      card?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    });
  };
}

/** Moves focus between the words in the box and its text input; see `boxMove`. */
export function useBoxArrows(
  box: Readonly<Ref<HTMLElement | null>>,
  input: Readonly<Ref<HTMLInputElement | null>>
) {
  return (event: KeyboardEvent): void => {
    const words = [...(box.value?.querySelectorAll<HTMLElement>('[data-token]') ?? [])];
    const field = input.value;
    if (!field) return;
    const focused = words.indexOf(document.activeElement as HTMLElement);
    const at = focused === -1 ? words.length : focused;
    const caretAtStart = field.selectionStart === 0 && field.selectionEnd === 0;
    const move = boxMove(at, words.length, event.key, caretAtStart);
    if (!move) return;
    event.preventDefault();
    if (move.target < words.length) {
      words[move.target].focus();
      return;
    }
    field.focus();
    const position = move.caret === 'start' ? 0 : field.value.length;
    field.setSelectionRange(position, position);
  };
}
