import { computed, shallowRef, type ShallowRef } from 'vue';
import type { InstructionGrammar } from './builderGrammar';

/**
 * The instruction being built word by word: the words chosen so far, and the ways each choice
 * changes them. The grammar of the architecture says what the words mean.
 */
export function useInstructionDraft<Action, Instruction>(
  grammar: InstructionGrammar<Action, Instruction>
) {
  const chosen: ShallowRef<Action[]> = shallowRef([]);

  /** The instructions once the words are complete; null while they are not. */
  const built = computed(() => grammar.build(chosen.value));
  const complete = computed(() => built.value !== null);
  const tokens = computed(() => grammar.tokens(chosen.value));

  function apply(action: Action): void {
    chosen.value = [...chosen.value, action];
  }

  /** Puts a whole instruction in the draft, as if its words had been chosen one by one. */
  function load(instruction: Instruction): void {
    chosen.value = grammar.parse(instruction);
  }

  function clear(): void {
    chosen.value = [];
  }

  /** Removes the token at `index` and everything after it. */
  function truncateTo(index: number): void {
    const token = tokens.value[index];
    if (token) chosen.value = chosen.value.slice(0, token.keep);
  }

  return { chosen, complete, built, tokens, apply, load, clear, truncateTo };
}
