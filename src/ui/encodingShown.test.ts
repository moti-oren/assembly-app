import { describe, expect, it } from 'vitest';
import { assemble } from '@/core/x86/encode';
import { execute } from '@/core/x86/execute';
import type { Instruction, Mnemonic } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import { step } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import type { RegisterName } from '@/core/x86/registers';
import { createCpuState } from '@/core/x86/state';
import { chooseEncoding, type EncodingSources } from './encodingShown';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

const program = [line('mov', reg('ax'), imm(1)), line('inc', reg('ax')), line('nop')];
const { lines } = assemble(program);
const base: EncodingSources = {
  program,
  lines,
  draft: null,
  inspected: null,
  next: null,
  last: null
};

describe('chooseEncoding', () => {
  it('shows the draft first, encoded as the next line of the program', () => {
    const draft = line('dec', reg('bx'));
    const shown = chooseEncoding({ ...base, draft, inspected: 1, next: 0 });
    expect(shown?.instruction).toBe(draft);
    expect(shown?.assembled.offset).toBe(lines[2].offset + lines[2].encoding.bytes.length);
    expect(shown?.where).toBe('as the next line of the program');
  });

  it('prefers an inspected line to the line at IP', () => {
    expect(chooseEncoding({ ...base, inspected: 2, next: 0 })?.where).toBe('line L2');
    expect(chooseEncoding({ ...base, next: 1 })?.where).toBe('line L1');
  });

  it('falls back to the last program line run once the program has finished', () => {
    const state = createCpuState();
    const last = step(X86, state, program);
    const shown = chooseEncoding({ ...base, last });
    expect(shown?.instruction).toBe(program[0]);
    expect(shown?.where).toBe('line L0, the last one run');
  });

  it('encodes an instruction run directly as if it came next', () => {
    const instruction = line('mov', reg('bx'), imm(2));
    const last = execute(createCpuState(), instruction);
    const shown = chooseEncoding({ ...base, last });
    expect(shown?.instruction).toBe(instruction);
    expect(shown?.where).toBe('the last instruction run');
  });

  it('shows nothing before anything has run', () => {
    expect(chooseEncoding(base)).toBeNull();
  });
});
