import { describe, expect, it } from 'vitest';
import { hasCircuit, type AluLink } from './aluLink';
import { hasControl, solveControl, type ControlView } from './controlLink';
import { activeLines, activeTerms, DECODER } from './logic/decoder';
import { solvePc } from './logic/programCounter';
import { mos6502ControlLink } from './mos6502ControlLink';
import { decode } from './rv32/decode';
import { execute, type ExecutionRecord } from './rv32/execute';
import { getSpec, MNEMONICS, type Instruction, type Mnemonic } from './rv32/instructions';
import type { Operand, OperandKind } from './rv32/operands';
import { parseRegister } from './rv32/registers';
import { addressOfLine, createCpuState, DATA_BASE, writeRegister } from './rv32/state';
import { rv32AluLink } from './rv32AluLink';
import { RV32_CONTROL } from './rv32Control';
import { controlImmediate, rv32ControlLink } from './rv32ControlLink';
import { x86ControlLink } from './x86ControlLink';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const NOP = line('addi', r('zero'), r('zero'), { type: 'imm', value: 0 });

const PROGRAM_LINES = 16;
/** The line the instruction under test sits on. */
const AT = 5;

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/** An operand of each kind that the CPU can run: addresses in RAM, targets inside the program. */
function operand(kind: OperandKind, position: number, next: () => number): Operand {
  switch (kind) {
    case 'reg':
      return r(['a0', 'a1', 'a2'][position]);
    case 'imm12':
      return { type: 'imm', value: (next() % 4096) - 2048 };
    case 'shamt':
      return { type: 'imm', value: next() % 32 };
    case 'imm20':
      return { type: 'imm', value: next() % 2 ** 20 };
    case 'mem':
      return { type: 'mem', base: parseRegister('a1')!, offset: (next() % 8) * 4 };
    case 'label':
      return { type: 'label', target: next() % PROGRAM_LINES };
  }
}

function sample(mnemonic: Mnemonic, next: () => number): Instruction {
  return line(mnemonic, ...getSpec(mnemonic).form.map((kind, i) => operand(kind, i, next)));
}

/** Runs the instruction on a real CPU, from the program or by itself, and links it. */
function run(instruction: Instruction, fetched: boolean, next: () => number) {
  const cpu = createCpuState();
  const { category } = getSpec(instruction.mnemonic);
  // A load or a store needs an address in RAM, and JALR one that is a program line.
  const base =
    category === 'load' || category === 'store'
      ? DATA_BASE + (next() % 64) * 4
      : instruction.mnemonic === 'jalr'
        ? addressOfLine(next() % 8)
        : next();
  writeRegister(cpu, parseRegister('a1')!, base);
  writeRegister(cpu, parseRegister('a2')!, next() % 3 === 0 ? base : next());
  writeRegister(cpu, parseRegister('a0')!, next() % 3 === 0 ? base : next());
  cpu.registers.pc = addressOfLine(AT);
  const program = Array.from({ length: PROGRAM_LINES }, (_, at) => (at === AT ? instruction : NOP));
  const record = execute(cpu, instruction, fetched ? AT : null, program);
  const link = rv32ControlLink(record);
  if (!hasControl(link)) throw new Error(link.unavailable);
  return { cpu, record, link, solution: solveControl(link.shape, link.word) };
}

type Run = ReturnType<typeof run>;

/** The lines of the main decoder against what the CPU's own decoding says of the instruction. */
function checkMain({ record, link, solution }: Run) {
  const on = (id: string) => solution.main.signals[id] === 1;
  const decoded = decode(record.instruction);
  expect(activeTerms(solution.main)).toHaveLength(1);
  expect(solution.main.signals[DECODER.none]).toBe(0);
  expect(on('regWrite')).toBe(decoded.writeBack !== null);
  expect(on('fromMemory')).toBe(decoded.writeBack === 'memory');
  expect(on('link')).toBe(decoded.writeBack === 'link');
  expect(on('upper')).toBe(decoded.writeBack === 'immediate');
  expect(on('memRead')).toBe(decoded.memory?.access === 'load');
  expect(on('memWrite')).toBe(decoded.memory?.access === 'store');
  expect(on('branch')).toBe(decoded.nextPc === 'branch');
  expect(on('jump')).toBe(decoded.nextPc === 'jump');
  expect(on('jumpRegister')).toBe(record.instruction.mnemonic === 'jalr');
  if (decoded.alu) {
    expect(on('aluSrcA')).toBe(decoded.alu.a === 'pc');
    expect(on('aluSrcB')).toBe(decoded.alu.b === 'immediate');
  }
  if (decoded.immediate !== null && !getSpec(record.instruction.mnemonic).form.includes('shamt')) {
    expect(controlImmediate(link.word, solution)).toBe(decoded.immediate);
  }
}

const TAP_LINES: Record<string, string> = {
  zero: 'readZero',
  less: 'readLess',
  carryOut: 'readCarry'
};

/** The ALU lines the circuit of the logic topic calls for, worked out from its own link. */
function expectedAluLines(record: ExecutionRecord, alu: AluLink): string[] {
  const { mnemonic } = record.instruction;
  if (!hasCircuit(alu)) return record.alu ? ['mulDiv'] : [];
  const { request, taps } = alu;
  if (request.kind === 'shift') {
    return [
      'aluShift',
      ...(request.direction === 'right' ? ['shiftRight'] : []),
      ...(request.fill === 'sign' ? ['shiftArithmetic'] : [])
    ];
  }
  if (request.kind === 'add') return ['aluSum'];
  if (request.kind !== 'subtract')
    return [`alu${request.kind[0].toUpperCase()}${request.kind.slice(1)}`];
  const [tap] = taps;
  if (!tap) return ['aluSum', 'aluSub'];
  if (record.comparison) {
    return ['aluSub', TAP_LINES[tap.tap], ...(tap.inverted ? ['invert'] : [])];
  }
  return [
    'aluSub',
    mnemonic.startsWith('sltu') || mnemonic === 'sltiu' ? 'setLessUnsigned' : 'setLess'
  ];
}

function checkAlu({ record, solution }: Run) {
  const expected = expectedAluLines(record, rv32AluLink(record));
  expect(activeLines(solution.alu).sort()).toEqual(expected.sort());
  expect(activeTerms(solution.alu).length).toBe(expected.length === 0 ? 0 : 1);
}

function checkPc({ cpu, link }: Run) {
  expect(link.pc).not.toBeNull();
  expect(solvePc(link.pc!).register.stored).toBe(cpu.registers.pc);
}

describe('rv32ControlLink', () => {
  describe.each(MNEMONICS)('%s', (mnemonic) => {
    it.each([
      ['fetched from the program', true],
      ['run by itself', false]
    ])('%s: the decoders and PC agree with the CPU', (_, fetched) => {
      const next = random(mnemonic.length * 131 + mnemonic.charCodeAt(1) + Number(fetched));
      for (let i = 0; i < 4; i++) {
        const result = run(sample(mnemonic, next), fetched, next);
        checkMain(result);
        checkAlu(result);
        checkPc(result);
      }
    });
  });

  it('follows a branch only when the subtraction says so', () => {
    const next = random(7);
    const taken = run(line('beq', r('a1'), r('a1'), { type: 'label', target: 2 }), true, next);
    expect(taken.link.pc).toMatchObject({ branch: 1, taken: 1, jump: 0 });
    expect(taken.cpu.registers.pc).toBe(addressOfLine(2));
    const passed = run(line('bne', r('a1'), r('a1'), { type: 'label', target: 2 }), true, next);
    expect(passed.link.pc).toMatchObject({ branch: 1, taken: 0 });
    expect(passed.cpu.registers.pc).toBe(addressOfLine(AT + 1));
  });

  it('leaves PC alone for an instruction run by itself', () => {
    const { link, cpu } = run(line('add', r('a0'), r('a1'), r('a2')), false, random(3));
    expect(link.pc).toMatchObject({ fetched: 0 });
    expect(link.pcNote).toContain('run by itself');
    expect(cpu.registers.pc).toBe(addressOfLine(AT));
  });

  it('gives the fields of the word, top bit first', () => {
    const { link } = run(line('sub', r('a0'), r('a1'), r('a2')), true, random(1));
    expect(link.fields.map((field) => field.label)).toEqual([
      'funct7',
      'rs2',
      'rs1',
      'funct3',
      'rd',
      'opcode'
    ]);
    expect(link.word & 0x7f).toBe(0b0110011);
  });

  it('does not show PC for a branch too far for its immediate', () => {
    const cpu = createCpuState();
    const far = line('bne', r('a1'), r('a1'), { type: 'label', target: 5000 });
    const link = rv32ControlLink(execute(cpu, far, null, [far]));
    expect(link).toMatchObject({ pc: null });
    expect((link as ControlView).pcNote).toContain('Out of range');
  });
});

describe('RV32_CONTROL', () => {
  it('knows no instruction in a word with an unused opcode', () => {
    const { main, alu } = solveControl(RV32_CONTROL, 0b1111111);
    expect(main.signals[DECODER.none]).toBe(1);
    expect(activeLines(main)).toEqual([]);
    expect(activeLines(alu)).toEqual([]);
  });

  it('gives every term and line a name of its own', () => {
    for (const { inputs, terms, lines } of [RV32_CONTROL.main, RV32_CONTROL.alu]) {
      const names = [...inputs, ...terms.map((term) => term.id), ...lines.map((each) => each.id)];
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('the CPUs without a control unit to show', () => {
  it('say why', () => {
    expect(hasControl(x86ControlLink())).toBe(false);
    expect(x86ControlLink()).toHaveProperty('unavailable');
    expect(hasControl(mos6502ControlLink())).toBe(false);
    expect(mos6502ControlLink()).toHaveProperty('unavailable');
  });
});
