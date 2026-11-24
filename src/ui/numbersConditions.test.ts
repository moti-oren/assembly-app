import { describe, expect, it } from 'vitest';
import { execute as run6502 } from '@/core/mos6502/execute';
import type {
  Instruction as Line6502,
  Mnemonic as Mnemonic6502
} from '@/core/mos6502/instructions';
import { createCpuState as create6502 } from '@/core/mos6502/state';
import { solveArithmetic } from '@/core/representation/arithmetic';
import { compare, holds } from '@/core/representation/comparison';
import { execute as runRv32 } from '@/core/rv32/execute';
import type { Instruction as LineRv32, Mnemonic as MnemonicRv32 } from '@/core/rv32/instructions';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState as createRv32, writeRegister } from '@/core/rv32/state';
import { execute as runX86 } from '@/core/x86/execute';
import type { Instruction as LineX86, Mnemonic as MnemonicX86 } from '@/core/x86/instructions';
import { createCpuState as createX86 } from '@/core/x86/state';
import { ARCHITECTURE_CHOICES } from './architectures';
import { differenceFlags } from './numbersCompare';
import { CONDITION_SETS, type Condition, type DifferenceFlags } from './numbersConditions';

const flagsOf = (a: number, b: number, width: 8 | 16 | 32): DifferenceFlags =>
  differenceFlags(solveArithmetic({ kind: 'subtract', width, a, b, extra: 0 }));

/** Whether the two numbers answer the condition's question with a yes. */
function truth(condition: Condition, a: number, b: number, width: number): boolean {
  const compared = compare(a, b, width);
  return holds(compared[condition.scale ?? 'unsigned'].order, condition.relation);
}

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/** Pairs that are equal, a step apart or on either side of the top bit now and then. */
function pairs(seed: number, limit: number, count: number): [number, number][] {
  const next = random(seed);
  return Array.from({ length: count }, () => {
    const a = next() % limit;
    const kind = next() % 5;
    if (kind === 0) return [a, a];
    if (kind === 1) return [a, (a + 1) % limit];
    if (kind === 2) return [a, (a + limit / 2) % limit];
    return [a, next() % limit];
  });
}

describe('CONDITION_SETS', () => {
  describe.each(ARCHITECTURE_CHOICES.map((choice) => choice.id))('%s', (id) => {
    const { conditions } = CONDITION_SETS[id];

    it('answers its question for every pair of bytes, where it claims to', () => {
      for (const condition of conditions.filter((each) => !each.caveat)) {
        for (let a = 0; a < 0x100; a++) {
          for (let b = 0; b < 0x100; b++) {
            const taken = condition.taken(flagsOf(a, b, 8));
            if (taken !== truth(condition, a, b, 8)) {
              throw new Error(`${condition.mnemonic} is wrong for ${a} and ${b}`);
            }
          }
        }
      }
    });

    it('is wrong only when the signed answer does not fit, where it warns', () => {
      for (const condition of conditions.filter((each) => each.caveat)) {
        let wrong = 0;
        for (let a = 0; a < 0x100; a++) {
          for (let b = 0; b < 0x100; b++) {
            const flags = flagsOf(a, b, 8);
            const misses = condition.taken(flags) !== truth(condition, a, b, 8);
            if (misses !== flags.overflow) {
              throw new Error(`${condition.mnemonic} for ${a} and ${b}`);
            }
            if (misses) wrong++;
          }
        }
        expect(wrong).toBeGreaterThan(0);
      }
    });
  });

  it('8086: every jump goes as the CPU’s does after CMP', () => {
    for (const condition of CONDITION_SETS.x86.conditions) {
      const mnemonic = condition.mnemonic.toLowerCase() as MnemonicX86;
      for (const [a, b] of pairs(mnemonic.length * 77 + mnemonic.charCodeAt(1), 0x10000, 200)) {
        const cpu = createX86();
        cpu.registers.ax = a;
        cpu.registers.bx = b;
        const cmp: LineX86 = {
          mnemonic: 'cmp',
          operands: [
            { type: 'reg', name: 'ax' },
            { type: 'reg', name: 'bx' }
          ]
        };
        runX86(cpu, cmp, 0);
        runX86(cpu, { mnemonic, operands: [{ type: 'label', target: 5 }] }, 0);
        expect(condition.taken(flagsOf(a, b, 16)), `${mnemonic} ${a} ${b}`).toBe(
          cpu.registers.ip === 5
        );
      }
    }
  });

  it('RISC-V: every branch goes as the CPU’s does', () => {
    const a1 = parseRegister('a1')!;
    const a2 = parseRegister('a2')!;
    for (const condition of CONDITION_SETS.rv32.conditions) {
      const mnemonic = condition.mnemonic.toLowerCase() as MnemonicRv32;
      const branch: LineRv32 = {
        mnemonic,
        operands: [
          { type: 'reg', index: a1 },
          { type: 'reg', index: a2 },
          { type: 'label', target: 0 }
        ]
      };
      for (const [a, b] of pairs(mnemonic.length * 53 + mnemonic.charCodeAt(1), 2 ** 32, 200)) {
        const cpu = createRv32();
        writeRegister(cpu, a1, a);
        writeRegister(cpu, a2, b);
        const record = runRv32(cpu, branch, null, [branch]);
        expect(condition.taken(flagsOf(a, b, 32)), `${mnemonic} ${a} ${b}`).toBe(
          record.comparison!.taken
        );
      }
    }
  });

  it('6502: every branch goes as the CPU’s does after CMP', () => {
    for (const condition of CONDITION_SETS.mos6502.conditions) {
      const mnemonic = condition.mnemonic.toLowerCase() as Mnemonic6502;
      for (const [a, b] of pairs(mnemonic.length * 31 + mnemonic.charCodeAt(1), 0x100, 200)) {
        const cpu = create6502();
        cpu.registers.a = a;
        const program: Line6502[] = [
          { mnemonic: 'cmp', operands: [{ type: 'imm', value: b }] },
          { mnemonic, operands: [{ type: 'label', target: 0 }] }
        ];
        run6502(cpu, program[0], 0, program);
        const record = run6502(cpu, program[1], 1, program);
        expect(condition.taken(flagsOf(a, b, 8)), `${mnemonic} ${a} ${b}`).toBe(
          record.branch!.taken
        );
      }
    }
  });
});
