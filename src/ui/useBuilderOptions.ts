import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import {
  filterOptions,
  splitWord,
  typedNumberIn,
  type BuilderOption,
  type DraftContext,
  type InstructionGrammar
} from './builderGrammar';
import { groupBy } from './groupBy';

/** The words chosen so far, as `useInstructionDraft` holds them. */
interface Draft<Action> {
  chosen: Readonly<Ref<Action[]>>;
  complete: Readonly<Ref<boolean>>;
}

/**
 * The builder's choices for the next word: the options that match what is typed, grouped as on
 * screen, the one Enter would pick, and the line that explains what is being looked at.
 */
export function useBuilderOptions<Action, Instruction>(
  grammar: InstructionGrammar<Action, Instruction>,
  draft: Draft<Action>,
  filter: Readonly<Ref<string>>,
  programLines: () => string[]
) {
  const { chosen, complete } = draft;
  /** The option under the pointer or keyboard focus; its hint is previewed below the input. */
  const hovered = shallowRef<BuilderOption<Action> | null>(null);

  const typedNumber = computed(() => typedNumberIn(filter.value));
  const context = computed<DraftContext>(() => ({
    typed: typedNumber.value,
    programLines: programLines()
  }));
  const visibleOptions = computed(() =>
    filterOptions(grammar.options(chosen.value, context.value), filter.value, typedNumber.value)
  );
  const groups = computed(() => groupBy(visibleOptions.value, (option) => option.group));

  const doesNotFit = computed(() => grammar.overflows(chosen.value, context.value));
  const hint = computed(() =>
    grammar.hint(chosen.value, context.value, filter.value, complete.value)
  );
  const moreToChoose = computed(() => grammar.hasMore(chosen.value));

  /** The options in the order they appear on screen (grouped), which the arrow keys walk through. */
  const orderedOptions = computed(() => groups.value.flatMap(([, options]) => options));
  /** Index into `orderedOptions` of the option the arrow keys moved to; Enter picks it. */
  const selectedIndex = ref(0);
  // A new list of options (typing, or a word chosen) starts again from the first one, and the
  // option a finger or pointer was on belongs to the old list: its words are no longer true.
  watch(visibleOptions, () => {
    selectedIndex.value = 0;
    hovered.value = null;
  });

  /** The option Enter would pick. */
  const enterOption = computed(() =>
    complete.value && !filter.value.trim()
      ? null
      : (orderedOptions.value[selectedIndex.value] ?? null)
  );

  /**
   * One line that explains what you are looking at: the hovered option; while typing, the option
   * Enter would pick; else the chosen instruction, or before one is chosen, Enter's option.
   */
  const preview = computed<{ label: string; text: string } | null>(() => {
    const described = grammar.describe(chosen.value);
    const typing = filter.value.trim() !== '';
    // Once the arrows have moved, the option they are on is what is being looked at.
    const arrowed = selectedIndex.value !== 0;
    const option =
      hovered.value ?? (described === null || typing || arrowed ? enterOption.value : null);
    if (option?.hint) return { label: option.label, text: option.hint };
    return described;
  });

  /** The options `text` would leave, in the order Enter would consider them. */
  function optionsFor(text: string): BuilderOption<Action>[] {
    const typed = typedNumberIn(text);
    const all = grammar.options(chosen.value, { typed, programLines: programLines() });
    const grouped = groupBy(filterOptions(all, text, typed), (option) => option.group);
    return grouped.flatMap(([, options]) => options);
  }

  /**
   * The word typed text has finished, and the option it picks: `mov ax 3` has finished `mov`.
   * Null while the text is still one word, or the word picks nothing.
   */
  function finishedWord(text: string): { option: BuilderOption<Action>; rest: string } | null {
    const goesOn = (start: string) =>
      optionsFor(start).some((option) =>
        option.label.toLowerCase().startsWith(start.toLowerCase())
      );
    const split = splitWord(text, goesOn);
    const option = split && optionsFor(split.word)[0];
    return split && option ? { option, rest: split.rest } : null;
  }

  return {
    finishedWord,
    hovered,
    groups,
    doesNotFit,
    hint,
    moreToChoose,
    orderedOptions,
    selectedIndex,
    enterOption,
    preview
  };
}
