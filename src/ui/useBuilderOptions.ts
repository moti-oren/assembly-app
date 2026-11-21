import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import { parseNumber } from '@/core/shared/numbers';
import {
  filterOptions,
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

  const typedNumber = computed(() => parseNumber(filter.value));
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
  // A new list of options (typing, or a word chosen) starts again from the first one.
  watch(visibleOptions, () => {
    selectedIndex.value = 0;
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
    const option = hovered.value ?? (described === null || typing ? enterOption.value : null);
    if (option?.hint) return { label: option.label, text: option.hint };
    return described;
  });

  return {
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
