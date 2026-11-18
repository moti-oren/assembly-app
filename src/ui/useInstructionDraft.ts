import { computed, ref } from 'vue';
import {
  isComplete,
  type Instruction,
  type Mnemonic,
  type RepeatPrefix
} from '@/core/x86/instructions';
import type { Size } from '@/core/shared/numbers';
import { formatOperand, type Operand } from '@/core/x86/operands';
import type { OptionAction } from './x86Grammar';

/** One word of the instruction as it is shown in the builder. */
export interface DraftToken {
  label: string;
  /** The memory operand whose address is still being chosen. */
  pending?: boolean;
  /** The prefix or the mnemonic, which head the instruction. */
  head?: boolean;
}

/** The instruction being built word by word, and the ways each choice changes it. */
export function useInstructionDraft() {
  /** A repeat prefix chosen before the mnemonic; it narrows the mnemonics to the ones it fits. */
  const prefix = ref<RepeatPrefix | null>(null);
  const mnemonic = ref<Mnemonic | null>(null);
  const operands = ref<Operand[]>([]);
  /** Set after choosing "byte [ ]" / "word [ ]", until the address inside the brackets is chosen. */
  const pendingMemory = ref<Size | null>(null);

  const complete = computed(
    () =>
      mnemonic.value !== null &&
      pendingMemory.value === null &&
      isComplete(mnemonic.value, operands.value)
  );

  /** The instruction once it is complete; null while it is not. */
  const built = computed<Instruction | null>(() => {
    if (!complete.value || mnemonic.value === null) return null;
    const instruction: Instruction = { mnemonic: mnemonic.value, operands: operands.value };
    if (prefix.value) instruction.prefix = prefix.value;
    return instruction;
  });

  const tokens = computed(() => {
    const list: DraftToken[] = [];
    if (prefix.value) list.push({ label: prefix.value, head: true });
    if (mnemonic.value) list.push({ label: mnemonic.value, head: true });
    operands.value.forEach((operand) => list.push({ label: formatOperand(operand) }));
    if (pendingMemory.value !== null) {
      list.push({ label: `${pendingMemory.value === 8 ? 'byte' : 'word'} [ ? ]`, pending: true });
    }
    return list;
  });

  function apply(action: OptionAction): void {
    switch (action.kind) {
      case 'prefix':
        prefix.value = action.prefix;
        return;
      case 'mnemonic':
        mnemonic.value = action.mnemonic;
        return;
      case 'operand':
        operands.value = [...operands.value, action.operand];
        pendingMemory.value = null;
        return;
      case 'memory':
        pendingMemory.value = action.size;
        return;
    }
  }

  function clear(): void {
    prefix.value = null;
    mnemonic.value = null;
    operands.value = [];
    pendingMemory.value = null;
  }

  /** Removes the token at `index` and everything after it. */
  function truncateTo(index: number): void {
    if (index === 0) {
      clear();
      return;
    }
    pendingMemory.value = null;
    if (prefix.value && index === 1) {
      mnemonic.value = null;
      operands.value = [];
    } else {
      operands.value = operands.value.slice(0, index - (prefix.value ? 2 : 1));
    }
  }

  return {
    prefix,
    mnemonic,
    operands,
    pendingMemory,
    complete,
    built,
    tokens,
    apply,
    clear,
    truncateTo
  };
}
