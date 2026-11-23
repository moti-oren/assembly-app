import { describe, expect, it } from 'vitest';
import { MOS6502 } from '@/core/mos6502/architecture';
import type { Instruction as Mos6502Instruction } from '@/core/mos6502/instructions';
import { RV32 } from '@/core/rv32/architecture';
import type {
  Instruction as Rv32Instruction,
  Mnemonic as Rv32Mnemonic
} from '@/core/rv32/instructions';
import type { Operand as Rv32Operand } from '@/core/rv32/operands';
import type { ExecutionRecord as Rv32Record } from '@/core/rv32/execute';
import type { CpuState as Rv32State } from '@/core/rv32/state';
import { execute } from '@/core/x86/execute';
import type { Instruction, Mnemonic } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import { PORTS } from '@/core/shared/devices';
import { step, type Program } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import type { RegisterName } from '@/core/x86/registers';
import { createCpuState, writeRegister } from '@/core/x86/state';
import {
  deviceSounds,
  mos6502Sounds,
  mos6502StepSound,
  raisedOverflow,
  rv32Sounds,
  rv32StepSound,
  stepSound,
  x86Sounds
} from './sounds';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const wordAt = (displacement: number): Operand => ({
  type: 'mem',
  size: 16,
  base: null,
  displacement
});
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** Runs one instruction directly and returns the sound it makes. */
function soundOf(instruction: Instruction) {
  const state = createCpuState();
  return stepSound(execute(state, instruction), state);
}

/** Steps a program `count` times and returns the sound of the last step. */
function soundAfterSteps(program: Program<Instruction>, count: number) {
  const state = createCpuState();
  let record = step(X86, state, program);
  for (let i = 1; i < count; i++) record = step(X86, state, program);
  return stepSound(record, state);
}

describe('stepSound', () => {
  it('gives every register write the same sound', () => {
    expect(soundOf(line('mov', reg('ax'), imm(5)))).toBe('register');
    expect(soundOf(line('mov', reg('si'), imm(5)))).toBe('register');
    expect(soundOf(line('mov', reg('sp'), imm(5)))).toBe('register');
  });

  it('marks a memory write', () => {
    expect(soundOf(line('mov', wordAt(0x10), imm(5)))).toBe('memory');
  });

  it('tells PUSH from POP', () => {
    expect(soundOf(line('push', reg('ax')))).toBe('push');
    expect(soundOf(line('pop', reg('ax')))).toBe('pop');
    expect(soundOf(line('pushf'))).toBe('push');
    expect(soundOf(line('popf'))).toBe('pop');
  });

  it('marks an instruction that only changes flags', () => {
    expect(soundOf(line('cmp', reg('ax'), imm(1)))).toBe('flags');
    expect(soundOf(line('stc'))).toBe('flags');
  });

  it('marks an instruction that changes nothing', () => {
    expect(soundOf(line('nop'))).toBe('idle');
  });

  it('tells a jump forward, a jump back and a jump not taken apart', () => {
    expect(soundAfterSteps([line('jmp', label(2)), line('nop'), line('nop')], 1)).toBe(
      'jump-forward'
    );
    expect(soundAfterSteps([line('nop'), line('jmp', label(0))], 2)).toBe('jump-back');
    // ZF is clear at reset, so JZ falls through.
    expect(soundAfterSteps([line('jz', label(2)), line('nop'), line('nop')], 1)).toBe('no-jump');
  });

  it('marks CALL and RET', () => {
    const program: Program<Instruction> = [line('call', label(2)), line('nop'), line('ret')];
    expect(soundAfterSteps(program, 1)).toBe('call');
    expect(soundAfterSteps(program, 2)).toBe('ret');
  });
});

describe('raisedOverflow', () => {
  it('is true only for the instruction that sets OF', () => {
    const state = createCpuState();
    writeRegister(state, 'ax', 0x7fff);
    const overflowing = execute(state, line('add', reg('ax'), imm(1)));
    expect(raisedOverflow(overflowing, state)).toBe(true);

    const after = execute(state, line('mov', reg('bx'), imm(1)));
    expect(raisedOverflow(after, state)).toBe(false);
  });
});

describe('rv32StepSound', () => {
  const rv = (mnemonic: Rv32Mnemonic, ...operands: Rv32Operand[]): Rv32Instruction => ({
    mnemonic,
    operands
  });
  const x = (index: number): Rv32Operand => ({ type: 'reg', index });
  const to = (target: number): Rv32Operand => ({ type: 'label', target });
  const program = [
    rv('jal', x(1), to(2)),
    rv('addi', x(10), x(0), { type: 'imm', value: 1 }),
    rv('jalr', x(0), { type: 'mem', base: 1, offset: 0 }),
    rv('beq', x(10), x(0), to(0))
  ];

  function soundOfLine(line: number, setup?: (state: Rv32State) => void) {
    const state = RV32.createState();
    RV32.setNextLine(state, line, program);
    setup?.(state);
    return rv32StepSound(step(RV32, state, program), state);
  }

  it('hears JAL with ra as a call and JALR through ra as a return', () => {
    expect(soundOfLine(0)).toBe('call');
    expect(soundOfLine(2, (state) => (state.registers.x1 = 4))).toBe('ret');
  });

  it('hears a register change, and a branch taken or not', () => {
    expect(soundOfLine(1)).toBe('register');
    expect(soundOfLine(3)).toBe('jump-back');
    expect(soundOfLine(3, (state) => (state.registers.x10 = 1))).toBe('no-jump');
  });
});

describe('mos6502StepSound', () => {
  const program: Mos6502Instruction[] = [
    { mnemonic: 'jsr', operands: [{ type: 'label', target: 2 }] },
    { mnemonic: 'nop', operands: [] },
    { mnemonic: 'rts', operands: [] }
  ];

  it('hears JSR as a call, RTS as a return, and PHA as a push', () => {
    const state = MOS6502.createState();
    const call = step(MOS6502, state, program);
    expect(mos6502StepSound(call, state)).toBe('call');
    expect(mos6502StepSound(step(MOS6502, state, program), state)).toBe('ret');
    const push = MOS6502.execute(state, { mnemonic: 'pha', operands: [] }, null, []);
    expect(mos6502StepSound(push, state)).toBe('push');
  });
});

describe('x86Sounds and mos6502Sounds', () => {
  it('lays the overflow under the instruction that raised it', () => {
    const state = createCpuState();
    writeRegister(state, 'ax', 0x7fff);
    const record = execute(state, line('add', reg('ax'), imm(1)));
    expect(x86Sounds(record, state)).toEqual({ step: 'register', layers: ['overflow'] });
  });

  it('does the same for V on the 6502', () => {
    const state = MOS6502.createState();
    state.registers.a = 0x7f;
    const adc: Mos6502Instruction = { mnemonic: 'adc', operands: [{ type: 'imm', value: 1 }] };
    const record = MOS6502.execute(state, adc, null, []);
    expect(mos6502Sounds(record, state)).toEqual({ step: 'register', layers: ['overflow'] });
  });
});

describe('deviceSounds', () => {
  const out = (port: number): Operand => imm(port);

  it('hears an LED change, but not the same byte written again', () => {
    const state = createCpuState();
    writeRegister(state, 'al', 0x0f);
    const leds = line('out', out(PORTS.leds), reg('al'));
    expect(deviceSounds(execute(state, leds))).toEqual(['led']);
    expect(deviceSounds(execute(state, leds))).toEqual([]);
  });

  it('hears every character printed, and nothing from an instruction without ports', () => {
    const state = createCpuState();
    const print = line('out', out(PORTS.terminal), reg('al'));
    expect(deviceSounds(execute(state, print))).toEqual(['terminal']);
    expect(deviceSounds(execute(state, print))).toEqual(['terminal']);
    expect(deviceSounds(execute(state, line('nop')))).toEqual([]);
  });
});

describe('rv32Sounds', () => {
  const rv = (mnemonic: Rv32Mnemonic, ...operands: Rv32Operand[]): Rv32Instruction => ({
    mnemonic,
    operands
  });
  const x = (index: number): Rv32Operand => ({ type: 'reg', index });
  const one: Rv32Operand = { type: 'imm', value: 1 };
  // x5 is used straight after it is made, then loaded and used: a forward, then a stall.
  const program = [
    rv('addi', x(5), x(0), one),
    rv('addi', x(6), x(5), one),
    rv('lw', x(7), { type: 'mem', base: 0, offset: 0x100 }),
    rv('addi', x(8), x(7), one),
    rv('beq', x(0), x(0), { type: 'label', target: 0 })
  ];

  function soundsAfter(steps: number, pipeline: { shown: boolean; forwarding: boolean }) {
    const state = RV32.createState();
    const history: Rv32Record[] = [];
    for (let i = 0; i < steps; i++) history.push(step(RV32, state, program));
    return rv32Sounds(history, state, program, { ...pipeline, predictor: 'not-taken' });
  }

  it('is the instruction itself while the pipeline is not shown', () => {
    expect(soundsAfter(1, { shown: false, forwarding: true })).toEqual({
      step: 'register',
      layers: []
    });
  });

  it('ticks once per instruction in the pipeline', () => {
    expect(soundsAfter(1, { shown: true, forwarding: true })).toEqual({
      step: 'pipeline-tick',
      layers: []
    });
  });

  it('marks a forwarded operand, a load-use stall and a flush', () => {
    const shown = { shown: true, forwarding: true };
    expect(soundsAfter(2, shown).layers).toEqual(['forward']);
    expect(soundsAfter(4, shown).layers).toEqual(['stall']);
    expect(soundsAfter(5, shown).layers).toEqual(['stall']);
  });

  it('stalls instead of forwarding when forwarding is off', () => {
    expect(soundsAfter(2, { shown: true, forwarding: false }).layers).toEqual(['stall']);
  });
});
