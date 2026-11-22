import { describe, expect, it } from 'vitest';
import { execute } from '@/core/x86/execute';
import { FLAG_NAMES, flagBit, isFlagSet, type FlagName } from '@/core/x86/flags';
import type { Instruction, Mnemonic } from '@/core/x86/instructions';
import { createCpuState } from '@/core/x86/state';
import { JUMP_RULES } from './x86Jumps';

/** The flags a jump can read. */
const TESTED: FlagName[] = ['CF', 'PF', 'ZF', 'SF', 'OF'];

/** Every combination of the tested flags, as a FLAGS value. */
const FLAG_VALUES = Array.from({ length: 1 << TESTED.length }, (_, bits) =>
  TESTED.reduce((flags, name, index) => (bits & (1 << index) ? flags | flagBit(name) : flags), 0)
);

/** Runs the jump on the real core, and says whether it jumped and the CX it left. */
function runs(mnemonic: Mnemonic, flags: number, cx: number): { taken: boolean; cx: number } {
  const state = createCpuState();
  state.flags = flags;
  state.registers.cx = cx;
  const jump: Instruction = { mnemonic, operands: [{ type: 'label', target: 5 }] };
  execute(state, jump, 0);
  return { taken: state.registers.ip === 5, cx: state.registers.cx };
}

describe('JUMP_RULES', () => {
  it('names only flags that exist', () => {
    for (const rule of Object.values(JUMP_RULES)) {
      for (const flag of rule.flags) expect(FLAG_NAMES).toContain(flag);
    }
  });

  it.each(Object.keys(JUMP_RULES) as Mnemonic[])('%s decides as the CPU does', (mnemonic) => {
    const rule = JUMP_RULES[mnemonic]!;
    for (const flags of FLAG_VALUES) {
      for (const cx of [0, 1, 2, 0xffff]) {
        const real = runs(mnemonic, flags, cx);
        const flag = (name: FlagName) => isFlagSet(flags, name);
        expect(rule.holds(flag, real.cx), `${mnemonic} flags=${flags} cx=${cx}`).toBe(real.taken);
      }
    }
  });

  it('reads no flag it does not name', () => {
    for (const rule of Object.values(JUMP_RULES)) {
      const read = new Set<FlagName>();
      rule.holds((name) => (read.add(name), true), 1);
      rule.holds((name) => (read.add(name), false), 1);
      for (const flag of read) expect(rule.flags).toContain(flag);
    }
  });
});
