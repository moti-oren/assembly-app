import { describe, expect, it } from 'vitest';
import { solveRegister, type RegisterRequest } from './logic/register';
import { solveRegisterFile } from './logic/registerFile';
import { hasRegisters } from './registerLink';
import { execute } from './rv32/execute';
import type { Instruction, Mnemonic } from './rv32/instructions';
import { formatRegister, type Operand } from './rv32/operands';
import { parseRegister, REGISTER_KEYS } from './rv32/registers';
import { createCpuState, writeRegister } from './rv32/state';
import { rv32RegisterLink } from './rv32RegisterLink';
import { snapshot } from './shared/state';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/**
 * Runs the instruction on a real CPU, then clocks the flip-flops of every register, written or
 * not, and checks each holds what the CPU's register holds. The register file, where the link
 * gives one, is clocked whole and checked the same way.
 */
function run(instruction: Instruction, from: number | null, next: () => number) {
  const cpu = createCpuState();
  for (const name of ['a0', 'a1', 'a2', 'ra']) writeRegister(cpu, parseRegister(name)!, next());
  const record = execute(cpu, instruction, from, [instruction]);
  const link = rv32RegisterLink(record, snapshot(cpu));
  const writes = hasRegisters(link) ? link.writes : [];
  REGISTER_KEYS.forEach((key, index) => {
    const write = writes.find((each) => each.register === formatRegister(index));
    const request: RegisterRequest = write?.request ?? {
      width: 32,
      held: record.before.registers[key],
      input: next(),
      enabled: 0
    };
    expect(`${key}=${solveRegister(request).stored}`).toBe(`${key}=${cpu.registers[key]}`);
  });
  if (link.file) {
    expect(solveRegisterFile(link.file.request).stored).toEqual(
      REGISTER_KEYS.map((key) => cpu.registers[key])
    );
  }
  return { link, writes };
}

function agrees(instruction: Instruction, from: number | null = null) {
  const next = random(instruction.mnemonic.length * 31 + instruction.operands.length);
  let last = run(instruction, from, next);
  for (let i = 0; i < 5; i++) last = run(instruction, from, next);
  return last;
}

describe('rv32RegisterLink', () => {
  it.each([
    line('add', r('a0'), r('a1'), r('a2')),
    line('sub', r('a1'), r('a1'), r('a2')),
    line('addi', r('a0'), r('a1'), imm(-7)),
    line('lui', r('a2'), imm(0xabcde)),
    line('sltu', r('a0'), r('a1'), r('a2'))
  ])('$mnemonic: the flip-flops hold what the CPU holds', (instruction) => {
    const { writes } = agrees(instruction);
    expect(writes).toHaveLength(1);
    expect(writes[0].request.enabled).toBe(0xffffffff);
  });

  it('shows the link register a jump wrote', () => {
    const { writes } = agrees(line('jal', r('ra'), label(0)), 0);
    expect(writes.map((write) => write.register)).toEqual(['ra']);
  });

  it('explains that x0 has no flip-flops to write', () => {
    const { link } = agrees(line('add', r('zero'), r('a1'), r('a2')));
    expect('unavailable' in link && link.unavailable).toContain('x0');
  });

  it('gives the file of 32 registers, with rd as the address written', () => {
    const { link } = agrees(line('addi', r('a0'), r('a1'), imm(-7)));
    expect(link.file?.request).toMatchObject({ address: 10, write: 1, zeroWired: true });
    expect(link.file?.request.held).toHaveLength(32);
    expect(link.file?.names[10]).toBe('a0');
  });

  it('gives the file for a write to x0, which no register keeps', () => {
    const { link } = agrees(line('add', r('zero'), r('a1'), r('a2')));
    const request = link.file!.request;
    expect(request.address).toBe(0);
    expect(request.input).toBe((request.held[11] + request.held[12]) >>> 0);
    expect(solveRegisterFile(request).loads).not.toContain(1);
  });

  it('knows what a jump and LUI sent to x0', () => {
    const jump = agrees(line('jal', r('zero'), label(0)), 0).link;
    expect(jump.file?.request).toMatchObject({ address: 0, input: 4 });
    const upper = agrees(line('lui', r('zero'), imm(0xabcde))).link;
    expect(upper.file?.request).toMatchObject({ address: 0, input: 0xabcde000 });
  });

  it('gives no file for a jump to x0 that was not fetched, whose link has no address', () => {
    expect(agrees(line('jal', r('zero'), label(0))).link.file).toBeUndefined();
  });

  it('has no register written to show for a branch', () => {
    const { link } = agrees(line('beq', r('a1'), r('a1'), label(0)), 0);
    expect(link).toMatchObject({
      unavailable:
        'BEQ wrote none of the registers shown here. PC, which every instruction from the program loads, is shown with the control unit.'
    });
  });

  it('does not say a store wrote only PC: it wrote memory too', () => {
    const store = line('sw', r('a0'), { type: 'mem', base: parseRegister('sp')!, offset: -4 });
    const { link } = agrees(store, 0);
    expect(link).toHaveProperty('unavailable');
    expect((link as { unavailable: string }).unavailable).toMatch(
      /^SW wrote none of the registers shown here/
    );
  });

  it('gives the file with its write line off for an instruction without an rd', () => {
    const { link } = agrees(line('beq', r('a1'), r('a2'), label(0)), 0);
    expect(link.file?.request).toMatchObject({ width: 32, write: 0 });
    const store = line('sw', r('a0'), { type: 'mem', base: parseRegister('sp')!, offset: -4 });
    // The address the decoder sees is bits 11 to 7 of the word: there, a store's immediate.
    expect(agrees(store, 0).link.file?.request).toMatchObject({ write: 0, address: 28 });
  });

  it('puts what the ALU of a branch made, rs1 − rs2, on the input it does not write', () => {
    const cpu = createCpuState();
    writeRegister(cpu, parseRegister('a1')!, 5);
    writeRegister(cpu, parseRegister('a2')!, 3);
    const branch = line('beq', r('a1'), r('a2'), label(0));
    const record = execute(cpu, branch, 0, [branch]);
    expect(rv32RegisterLink(record, snapshot(cpu)).file?.request.input).toBe(2);
  });

  it('reads the address from the word as it is encoded where the branch ran', () => {
    // At line 3 (address 12), a branch back to L0 is -12 away, 0x1FF4 in 13 bits. Bits 11 to 8
    // of the word are its bits 4 to 1 (0b1010) and bit 7 its bit 11 (1): 0b10101. Encoded at
    // address 0 instead, the distance and the field would be 0.
    const branch = line('beq', r('a1'), r('a2'), label(0));
    const program = [line('nop'), line('nop'), line('nop'), branch];
    const cpu = createCpuState();
    const record = execute(cpu, branch, 3, program);
    expect(rv32RegisterLink(record, snapshot(cpu)).file?.request.address).toBe(21);
  });

  it('wraps a difference below 0, as the 32 bits of the ALU do', () => {
    const cpu = createCpuState();
    writeRegister(cpu, parseRegister('a1')!, 3);
    writeRegister(cpu, parseRegister('a2')!, 5);
    const branch = line('bltu', r('a1'), r('a2'), label(0));
    const record = execute(cpu, branch, 0, [branch]);
    expect(rv32RegisterLink(record, snapshot(cpu)).file?.request.input).toBe(0xfffffffe);
  });
});
