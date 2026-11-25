import { describe, expect, it } from 'vitest';
import { step, type Program } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import { execute } from '@/core/x86/execute';
import type { Instruction, Mnemonic } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import type { RegisterName } from '@/core/x86/registers';
import { createCpuState } from '@/core/x86/state';
import { describeDecode, describeExecute, describeFetch } from './x86Explain';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** Steps the program `count` times and explains the last step. */
function explain(program: Program<Instruction>, count: number): string {
  const state = createCpuState();
  let record = step(X86, state, program);
  for (let i = 1; i < count; i++) record = step(X86, state, program);
  return describeExecute(record, state);
}

describe('the cycle in words', () => {
  it('says where the line is fetched from', () => {
    expect(describeFetch(2)).toBe(
      'IP points at L2. That line is read out of the program, and IP will move on to L3: the registers on show change once the instruction has run.'
    );
  });

  it('names the operands and what the instruction will touch', () => {
    expect(describeDecode(line('add', reg('ax'), reg('bx')))).toContain(
      'It will read AX and BX. It will write AX and the flags.'
    );
  });

  it('says what changed and where IP went', () => {
    const program = [line('mov', reg('ax'), imm(5)), line('jmp', label(0))];
    expect(explain(program, 1)).toBe('It changed AX. IP is at L1, the next line.');
    expect(explain(program, 2)).toBe(
      'It changed no register, flag or memory. It jumped: IP is now L0.'
    );
  });

  describe('names the part of AX..DX that changed', () => {
    /** Runs `instruction` with AX set to `ax` first, and says what it changed. */
    const changedBy = (instruction: Instruction, ax: number) => {
      const state = createCpuState();
      state.registers.ax = ax;
      const record = execute(state, instruction);
      return describeExecute(record, state).replace('Ran directly (not from the program). ', '');
    };

    it('says the byte an instruction wrote, and not a half it only read', () => {
      expect(changedBy(line('mov', reg('al'), imm(5)), 0)).toBe('It changed AL.');
      expect(changedBy(line('mov', reg('al'), reg('ah')), 0x1200)).toBe('It changed AL.');
      // Port 0 reads 0, so AL loses its 0xFF.
      expect(changedBy(line('in', reg('al'), reg('dx')), 0x12ff)).toBe('It changed AL.');
      expect(changedBy(line('add', reg('ah'), reg('al')), 0x0102)).toBe(
        'It changed AH and the flags.'
      );
    });

    it('says the word where the instruction names it, or changed both bytes', () => {
      expect(changedBy(line('mov', reg('ax'), imm(5)), 0)).toBe('It changed AX.');
      expect(changedBy(line('mul', reg('ah')), 0x1010)).toBe('It changed AX and the flags.');
    });

    it('says both halves where the instruction names both', () => {
      expect(changedBy(line('xchg', reg('al'), reg('ah')), 0x1234)).toBe('It changed AL and AH.');
      const state = createCpuState();
      Object.assign(state.registers, { ax: 0x1200, bx: 0x0034 });
      const record = execute(state, line('xchg', reg('ah'), reg('bl')));
      expect(describeExecute(record, state)).toContain('It changed AH and BL.');
    });
  });

  it('says an instruction from the builder ran directly', () => {
    const state = createCpuState();
    const record = execute(state, line('mov', reg('ax'), imm(5)));
    expect(describeExecute(record, state)).toBe(
      'Ran directly (not from the program). It changed AX.'
    );
  });
});

describe('a conditional jump in words', () => {
  const compare = (jump: Mnemonic): Program<Instruction> => [
    line('mov', reg('ax'), imm(-5)),
    line('cmp', reg('ax'), imm(3)),
    line(jump, label(0))
  ];

  it('says which flags stopped a jump that was not taken', () => {
    expect(explain(compare('jge'), 3)).toBe(
      'Not taken: JGE jumps when SF = OF, but SF is 1 and OF is 0. IP is at L3, the next line.'
    );
  });

  it('says which flags let a jump through', () => {
    expect(explain(compare('jl'), 3)).toBe(
      'Taken: JL jumps when SF ≠ OF, and SF is 1 and OF is 0. IP is now L0.'
    );
  });

  it('counts CX down for LOOP before testing it', () => {
    const twice = [line('mov', reg('cx'), imm(2)), line('loop', label(1))];
    expect(explain(twice, 2)).toBe(
      'It changed CX. Taken: LOOP jumps when CX ≠ 0 after counting it down, and CX is 1. IP is now L1.'
    );
    expect(explain(twice, 3)).toBe(
      'It changed CX. Not taken: LOOP jumps when CX ≠ 0 after counting it down, but CX is 0. IP is at L2, the next line.'
    );
  });

  it('does not take a jump to the next line for a jump that fell through', () => {
    const next = [line('mov', reg('ax'), imm(0)), line('jcxz', label(2))];
    expect(explain(next, 2)).toBe(
      'Taken: JCXZ jumps when CX = 0, and CX is 0. IP is at L2, the next line.'
    );
  });
});
