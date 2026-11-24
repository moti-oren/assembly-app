import { describe, expect, it } from 'vitest';
import { hasCircuit } from './aluLink';
import { hasControl, solveControl, type ControlView } from './controlLink';
import type { Faults } from './logic/fault';
import { solvePc } from './logic/programCounter';
import { execute } from './rv32/execute';
import { getSpec, MNEMONICS, type Instruction, type Mnemonic } from './rv32/instructions';
import type { Operand, OperandKind } from './rv32/operands';
import { parseRegister, registerKey } from './rv32/registers';
import {
  addressOfLine,
  createCpuState,
  DATA_BASE,
  DEVICE_BASE,
  readRegister,
  writeRegister
} from './rv32/state';
import { rv32AluLink } from './rv32AluLink';
import { setInputPort } from './shared/state';
import { rv32ControlLink } from './rv32ControlLink';
import { memoryBefore } from './rv32ControlMemory';
import { runDatapath } from './rv32ControlPath';

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
function operand(kind: OperandKind, position: number, next: () => number, align: number): Operand {
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
      return { type: 'mem', base: parseRegister('a1')!, offset: (next() % (32 / align)) * align };
    case 'label':
      return { type: 'label', target: next() % PROGRAM_LINES };
  }
}

/** A byte or a half-word is read and written at every place inside a word, not only its start. */
const ALIGNMENT: Partial<Record<Mnemonic, number>> = { lb: 1, lbu: 1, sb: 1, lh: 2, lhu: 2, sh: 2 };

function sample(mnemonic: Mnemonic, next: () => number): Instruction {
  const align = ALIGNMENT[mnemonic] ?? 4;
  return line(mnemonic, ...getSpec(mnemonic).form.map((kind, i) => operand(kind, i, next, align)));
}

/** The registers and memory an instruction is run against. */
function prepared(instruction: Instruction, next: () => number) {
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
  for (let at = 0; at < 512; at++) cpu.memory[DATA_BASE + at] = next() & 0xff;
  cpu.registers.pc = addressOfLine(AT);
  return cpu;
}

/** Runs the instruction on a real CPU, then does its word again as the datapath, lines broken. */
function run(instruction: Instruction, fetched: boolean, next: () => number, faults: Faults = {}) {
  const cpu = prepared(instruction, next);
  const program = Array.from({ length: PROGRAM_LINES }, (_, at) => (at === AT ? instruction : NOP));
  const record = execute(cpu, instruction, fetched ? AT : null, program);
  const link = rv32ControlLink(record, memoryBefore(cpu, program, record));
  if (!hasControl(link)) throw new Error(link.unavailable);
  const solution = solveControl(link.shape, link.word, faults);
  return { cpu, record, link, outcome: runDatapath(link.word, solution, link.context) };
}

type Run = ReturnType<typeof run>;

/** The registers as the datapath leaves them, against the CPU's. */
function checkRegisters({ cpu, link, outcome }: Run) {
  const registers = [...link.context.registers];
  if (outcome.write && outcome.write.index !== 0) {
    registers[outcome.write.index] = outcome.write.value;
  }
  registers.forEach((value, index) => expect(value).toBe(readRegister(cpu, index)));
}

function checkMemory({ record, outcome }: Run) {
  const { access } = record;
  const step = access && { address: access.address, size: access.size, value: access.value };
  expect(outcome.loaded).toEqual(access && !access.write ? step : null);
  expect(outcome.stored).toEqual(access?.write ? step : null);
}

function checkAlu({ record, outcome }: Run) {
  const alu = rv32AluLink(record);
  if (hasCircuit(alu)) expect(outcome.request).toEqual(alu.request);
  if (record.alu) expect(outcome.result).toBe(record.alu.result);
}

describe('runDatapath', () => {
  describe.each(MNEMONICS)('%s', (mnemonic) => {
    it.each([
      ['fetched from the program', true],
      ['run by itself', false]
    ])('%s: the lines alone do what the CPU did', (_, fetched) => {
      const next = random(mnemonic.length * 257 + mnemonic.charCodeAt(1) + Number(fetched));
      for (let i = 0; i < 12; i++) {
        const result = run(sample(mnemonic, next), fetched, next);
        expect(result.outcome.trap).toBeNull();
        expect(result.outcome.conflicts).toEqual([]);
        checkRegisters(result);
        checkMemory(result);
        checkAlu(result);
        expect(solvePc(result.outcome.pc).register.stored).toBe(result.cpu.registers.pc);
      }
    });
  });

  it('loads a byte from a device', () => {
    const lbu = line('lbu', r('a0'), { type: 'mem', base: parseRegister('a1')!, offset: 0 });
    const cpu = createCpuState();
    writeRegister(cpu, parseRegister('a1')!, DEVICE_BASE);
    setInputPort(cpu, 0, 0xc3);
    const record = execute(cpu, lbu, 0, [lbu]);
    const link = rv32ControlLink(record, memoryBefore(cpu, [lbu], record)) as ControlView;
    const outcome = runDatapath(link.word, solveControl(link.shape, link.word), link.context);
    expect(outcome.write).toMatchObject({ value: 0xc3, from: 'memory' });
    expect(outcome.trap).toBeNull();
  });

  it('traps on a target that is not the start of an instruction', () => {
    const beq = line('beq', r('a1'), r('a1'), { type: 'label', target: AT + 1 });
    const { link } = run(beq, true, random(3));
    // Bit 8 of the word is bit 1 of a branch's distance.
    const word = (link.word ^ (1 << 8)) >>> 0;
    const outcome = runDatapath(word, solveControl(link.shape, word), link.context);
    expect(outcome.trap).toContain('misaligned');
  });

  it('says when the word is no instruction, and follows its lines all the same', () => {
    // A LOAD with funct3 = 6, which RV32 has none of.
    const { link } = run(
      line('lw', r('a0'), { type: 'mem', base: 11, offset: 0 }),
      true,
      random(3)
    );
    const word = (link.word | (0b110 << 12)) >>> 0;
    const outcome = runDatapath(word, solveControl(link.shape, word), link.context);
    expect(outcome.conflicts).toContainEqual({ kind: 'illegal', lines: [] });
  });

  it('presents a write to x0, which the register file does not keep', () => {
    const { outcome, cpu } = run(line('add', r('zero'), r('a1'), r('a2')), true, random(2));
    expect(outcome.write).toMatchObject({ index: 0, from: 'alu' });
    expect(cpu.registers[registerKey(0)]).toBe(0);
  });
});

describe('runDatapath with a broken line', () => {
  const ADD = line('add', r('a0'), r('a1'), r('a2'));
  const LW = line('lw', r('a0'), { type: 'mem', base: parseRegister('a1')!, offset: 8 });

  it('writes no register with RegWrite stuck at 0', () => {
    const { outcome } = run(ADD, true, random(4), { regWrite: 0 });
    expect(outcome.write).toBeNull();
    expect(outcome.result).not.toBeNull();
  });

  it('takes the immediate, which an ADD has none of, with ALUSrcB stuck at 1', () => {
    const { outcome } = run(ADD, true, random(4), { aluSrcB: 1 });
    expect(outcome.b).toEqual({ from: 'immediate', value: 0 });
    expect(outcome.write?.value).toBe(outcome.rs1.value);
  });

  it('stores rs2 where the ALU points with MemWrite stuck at 1, or traps', () => {
    const { outcome } = run(LW, true, random(4), { memWrite: 1 });
    expect(outcome.stored).toEqual({
      address: outcome.result,
      size: 4,
      value: outcome.rs2.value
    });
    const wild = run(ADD, true, random(5), { memWrite: 1 }).outcome;
    expect(wild.trap).toContain('Access fault');
    expect(wild.stored?.value).toBeNull();
    expect(wild.write).toBeNull();
  });

  it('goes on to the target with Jump stuck at 1', () => {
    const { outcome, link } = run(ADD, true, random(4), { jump: 1 });
    expect(solvePc(outcome.pc).register.stored).toBe(link.context.here);
  });

  it('reports two values sent to rd at once', () => {
    const { outcome } = run(LW, true, random(4), { link: 1 });
    expect(outcome.conflicts).toEqual([{ kind: 'source', lines: ['fromMemory', 'link'] }]);
    expect(outcome.write?.from).toBe('memory');
  });

  it('reports an address nothing worked out', () => {
    const { outcome } = run(LW, true, random(4), { aluAdd: 0 });
    expect(outcome.result).toBeNull();
    expect(outcome.conflicts).toContainEqual({ kind: 'noResult', lines: ['memRead'] });
  });

  it('reports rd taking what memory gave when memory was not read', () => {
    const { outcome } = run(ADD, true, random(4), { fromMemory: 1 });
    expect(outcome.conflicts).toEqual([{ kind: 'notRead', lines: ['fromMemory'] }]);
  });
});
