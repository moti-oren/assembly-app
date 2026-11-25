import { describe, expect, it } from 'vitest';
import { hasControl, solveControl, type ControlView } from '@/core/controlLink';
import { solvePc } from '@/core/logic/programCounter';
import { execute } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState } from '@/core/rv32/state';
import { RV32_CONTROL } from '@/core/rv32Control';
import { rv32ControlLink } from '@/core/rv32ControlLink';
import { memoryBefore } from '@/core/rv32ControlMemory';
import { x86ControlLink } from '@/core/x86ControlLink';
import {
  controlLabel,
  controlLines,
  equationText,
  fieldMarks,
  inputLabel,
  parseWord,
  pcChoiceText,
  pcPhaseText,
  readingText,
  STARTING_WORD,
  unavailableText,
  withBitFlipped,
  wordFields
} from './controlView';

const reg = (name: string) => ({ type: 'reg' as const, index: parseRegister(name)! });
const NOP: Instruction = {
  mnemonic: 'addi',
  operands: [reg('zero'), reg('zero'), { type: 'imm', value: 0 }]
};

function view(instruction: Instruction, line: number | null = 0): ControlView {
  const program = [instruction, NOP, NOP, NOP];
  const cpu = createCpuState();
  const record = execute(cpu, instruction, line, program);
  const link = rv32ControlLink(record, memoryBefore(cpu, program, record));
  if (!hasControl(link)) throw new Error(link.unavailable);
  return link;
}

const BEQ: Instruction = {
  mnemonic: 'beq',
  operands: [reg('a0'), reg('a0'), { type: 'label', target: 2 }]
};
const BNE: Instruction = { ...BEQ, mnemonic: 'bne' };
const JAL: Instruction = { mnemonic: 'jal', operands: [reg('ra'), { type: 'label', target: 3 }] };

describe('labels', () => {
  it('names lines, terms and wires', () => {
    expect(controlLabel('regWrite')).toBe('RegWrite');
    expect(controlLabel('OP_IMM')).toBe('OP-IMM');
    expect(controlLabel('srai')).toBe('SRAI');
    expect(inputLabel('f3_2', RV32_CONTROL.wires)).toBe('14');
    expect(inputLabel('aluAdd', RV32_CONTROL.wires)).toBe('ALUAdd');
  });

  it('has a name and a meaning for every line of RISC-V’s decoders', () => {
    const rows = controlLines(solveControl(RV32_CONTROL, STARTING_WORD));
    expect(rows).toHaveLength(RV32_CONTROL.main.lines.length + RV32_CONTROL.alu.lines.length);
    for (const row of rows) {
      expect(row.label).not.toBe(row.id.toUpperCase());
      expect(row.does).not.toBe('');
    }
  });
});

describe('controlLines', () => {
  it('puts the lines that are on first', () => {
    const rows = controlLines(solveControl(RV32_CONTROL, STARTING_WORD));
    expect(rows.filter((row) => row.on).map((row) => row.label)).toEqual(['RegWrite', 'Sum']);
    expect(rows.slice(0, 2).every((row) => row.on)).toBe(true);
  });
});

describe('equationText', () => {
  it('says what the word is and which lines it turns on', () => {
    expect(equationText(STARTING_WORD, solveControl(RV32_CONTROL, STARTING_WORD))).toBe(
      '0x00B50533 is OP: RegWrite, Sum'
    );
  });

  it('says a broken line apart from what the word turns on', () => {
    const word = STARTING_WORD;
    const healthy = solveControl(RV32_CONTROL, word);
    expect(controlLabel('memWrite')).toBe('MemWrite');
    expect(equationText(word, healthy, { memWrite: 1 })).toBe(
      '0x00B50533 is OP: RegWrite, Sum, with MemWrite stuck at 1'
    );
  });

  it('says so when the opcode is not one the decoder knows', () => {
    expect(equationText(0x7f, solveControl(RV32_CONTROL, 0x7f))).toBe(
      '0x0000007F is no instruction the decoder knows'
    );
  });
});

describe('unavailableText', () => {
  it('passes on why a CPU has nothing to show', () => {
    expect(unavailableText(x86ControlLink())).toContain('microcode');
    expect(unavailableText(view(JAL))).toBeNull();
    expect(unavailableText(null)).toBeNull();
  });
});

describe('wordFields', () => {
  it('gives the instruction’s own fields while the word is the CPU’s', () => {
    const link = view(JAL);
    const fields = wordFields(link.shape.reads, link.fields, link.word);
    expect(fields.at(-1)).toMatchObject({
      label: 'opcode',
      range: 'bits 6–0',
      bits: '1101111',
      decoded: true
    });
    expect(fields.find((field) => field.label === 'rd')).toMatchObject({
      bits: '00001',
      decoded: false
    });
  });

  it('keeps only what the decoders read once the word was changed', () => {
    const link = view(JAL);
    const fields = wordFields(link.shape.reads, null, withBitFlipped(link.word, 30));
    expect(fields.map((field) => field.label)).toEqual([
      'funct7[5]',
      'funct7[0]',
      'funct3',
      'opcode'
    ]);
    expect(fields[0]).toMatchObject({ range: 'bit 30', decoded: true });
  });
});

describe('withBitFlipped', () => {
  it('turns one bit over, the top one too', () => {
    expect(withBitFlipped(0, 31)).toBe(0x80000000);
    expect(withBitFlipped(0x80000001, 31)).toBe(1);
  });
});

describe('pcChoiceText', () => {
  const text = (instruction: Instruction, line: number | null = 0) =>
    pcChoiceText(solvePc(view(instruction, line).pc!));

  it('says which address PC takes, and why', () => {
    expect(text(BEQ)).toContain('came out true');
    expect(text(BNE)).toContain('came out false');
    expect(text(JAL)).toContain('Jump is 1');
    expect(text(NOP)).toContain('PC takes PC + 4');
    expect(text(NOP, null)).toContain('keeps its value');
  });
});

describe('parseWord', () => {
  it('reads up to eight hex digits, with or without 0x', () => {
    expect(parseWord('0x40B50533')).toBe(0x40b50533);
    expect(parseWord(' 40b5 0533 ')).toBe(0x40b50533);
    expect(parseWord('ffffffff')).toBe(0xffffffff);
    expect(parseWord('13')).toBe(0x13);
  });

  it('refuses anything else', () => {
    expect(parseWord('')).toBeNull();
    expect(parseWord('0x')).toBeNull();
    expect(parseWord('123456789')).toBeNull();
    expect(parseWord('sub')).toBeNull();
  });
});

describe('readingText', () => {
  const read = (word: number) => readingText(word, solveControl(RV32_CONTROL, word));

  it('writes an instruction as assembly', () => {
    expect(read(0x40b50533)).toBe('As assembly: sub a0, a0, a1');
  });

  it('says when the decoders accept a word that is no instruction', () => {
    expect(read(0xc0b50533)).toContain('takes this for OP');
  });

  it('says when the opcode is unknown', () => {
    expect(read(0)).toBe(
      'This CPU has no instruction with this opcode: it runs RV32IM without ECALL, EBREAK and FENCE.'
    );
  });
});

describe('pcPhaseText', () => {
  it('says PC took the address only when its load line is 1', () => {
    expect(pcPhaseText('high', true)).toContain('PC took the address');
    for (const phase of ['before', 'high', 'after'] as const) {
      expect(pcPhaseText(phase, false)).not.toContain('PC took');
      expect(pcPhaseText(phase, false)).toContain('load line');
    }
  });
});

describe('fieldMarks', () => {
  it('brackets each field over its bits, named at its leftmost bit', () => {
    const fields = [
      { label: 'funct3', high: 14, low: 12, note: '', decoded: true },
      { label: 'opcode', high: 6, low: 0, note: '', decoded: true }
    ];
    const marks = fieldMarks(fields);
    expect(marks).toHaveLength(32);
    expect(marks[0].bit).toBe(31);
    const at = (bit: number) => marks.find((mark) => mark.bit === bit)!;
    expect(at(14)).toMatchObject({ label: 'funct3', start: true, end: false, decoded: true });
    expect(at(12)).toMatchObject({ label: null, start: false, end: true });
    expect(at(6).label).toBe('opcode');
    expect(at(20)).toMatchObject({ label: null, start: false, end: false, decoded: false });
  });
});
