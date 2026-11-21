import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { snapshot } from '@/core/shared/state';
import { execute as executeX86 } from '@/core/x86/execute';
import { createCpuState as createX86, writeRegister as writeX86 } from '@/core/x86/state';
import { execute as executeRv32 } from '@/core/rv32/execute';
import type { Instruction as Rv32Instruction } from '@/core/rv32/instructions';
import { parseRegister } from '@/core/rv32/registers';
import {
  createCpuState as createRv32,
  DATA_BASE,
  DEVICE_BASE as RV32_DEVICES,
  writeRegister
} from '@/core/rv32/state';
import { execute as execute6502 } from '@/core/mos6502/execute';
import type { Instruction as Mos6502Instruction } from '@/core/mos6502/instructions';
import { createCpuState as create6502, DEVICE_BASE as MOS6502_DEVICES } from '@/core/mos6502/state';
import {
  mos6502RegisterChange,
  mos6502StepDiff,
  rv32RegisterChange,
  rv32StepDiff,
  x86Pointer,
  x86RegisterChange,
  x86StepDiff
} from './architectureDiffs';
import { MEMORY_ENTRIES, type StepDiff } from './stepDiff';

// The tests pass the CPU itself as the state a step left: nothing moves it in between.
const shown = ({ entries }: StepDiff) =>
  entries.map((entry) =>
    entry.unchanged
      ? `${entry.name} = ${entry.after}`
      : `${entry.name} ${entry.before}→${entry.after}${entry.jump ? ' jump' : ''}`
  );

describe('the 8086', () => {
  it('lists the register written, then the flags, then IP moving on', () => {
    const cpu = createX86();
    const record = executeX86(
      cpu,
      {
        mnemonic: 'mov',
        operands: [
          { type: 'reg', name: 'cx' },
          { type: 'imm', value: 10 }
        ]
      },
      0
    );
    expect(shown(x86StepDiff(record, cpu))).toEqual(['CX 0000→000A', 'IP 0000→0001']);
  });

  it('shows a byte register at its own size, and a write that changed nothing', () => {
    const cpu = createX86();
    const record = executeX86(cpu, {
      mnemonic: 'xor',
      operands: [
        { type: 'reg', name: 'al' },
        { type: 'reg', name: 'al' }
      ]
    });
    const diff = x86StepDiff(record, cpu);
    expect(shown(diff)[0]).toBe('AL = 00');
    expect(diff.entries.some((entry) => entry.name === 'PF')).toBe(true);
  });

  it('marks a jump to another line', () => {
    const cpu = createX86();
    const record = executeX86(
      cpu,
      { mnemonic: 'jmp', operands: [{ type: 'label', target: 6 }] },
      2
    );
    expect(x86Pointer(record, cpu)?.jump).toBe(true);
    expect(shown(x86StepDiff(record, cpu))).toEqual(['IP 0000→0006 jump']);
  });

  it('gives one register its change, a half at its own size, IP as a pointer', () => {
    const cpu = createX86();
    const record = executeX86(
      cpu,
      {
        mnemonic: 'mov',
        operands: [
          { type: 'reg', name: 'ah' },
          { type: 'imm', value: 0x2a }
        ]
      },
      0
    );
    expect(x86RegisterChange(record, cpu, 'ah')).toMatchObject({ before: '00', after: '2A' });
    expect(x86RegisterChange(record, cpu, 'ax')).toMatchObject({ before: '0000', after: '2A00' });
    expect(x86RegisterChange(record, cpu, 'al')).toBeNull();
    expect(x86RegisterChange(record, cpu, 'bx')).toBeNull();
    expect(x86RegisterChange(record, cpu, 'ip')).toMatchObject({ after: '0001', jump: false });
  });

  it('reads a word store as one entry, at its physical address', () => {
    const cpu = createX86();
    const record = executeX86(cpu, {
      mnemonic: 'mov',
      operands: [
        { type: 'mem', size: 16, base: null, displacement: 0x10 },
        { type: 'imm', value: 0x1234 }
      ]
    });
    expect(shown(x86StepDiff(record, cpu))).toEqual(['[10010h] 0000→1234']);
  });

  it('lists a byte written to an output port', () => {
    const cpu = createX86();
    writeX86(cpu, 'al', 0xa5);
    const record = executeX86(cpu, {
      mnemonic: 'out',
      operands: [
        { type: 'imm', value: PORTS.leds },
        { type: 'reg', name: 'al' }
      ]
    });
    expect(shown(x86StepDiff(record, cpu))).toContain('port 0010h 00→A5');
  });

  it('lists the first memory writes of a long string instruction and counts the rest', () => {
    const cpu = createX86();
    writeX86(cpu, 'al', 0x2a);
    writeX86(cpu, 'cx', 200);
    const record = executeX86(cpu, { prefix: 'rep', mnemonic: 'stosb', operands: [] });
    const diff = x86StepDiff(record, cpu);
    const memory = diff.entries.filter((entry) => entry.kind === 'memory');
    expect(memory).toHaveLength(MEMORY_ENTRIES);
    expect(diff.omitted).toBe(100 - MEMORY_ENTRIES);
  });

  it('tells IP against the CPU as the step left it, not after an edit moved it', () => {
    const cpu = createX86();
    const record = executeX86(cpu, { mnemonic: 'nop', operands: [] }, 0);
    const after = snapshot(cpu);
    // A line inserted above moves IP down one line, which the step never did.
    writeX86(cpu, 'ip', 2);
    expect(x86Pointer(record, after)).toMatchObject({ before: '0000', after: '0001', jump: false });
    expect(x86Pointer(record, cpu)?.jump).toBe(true);
  });
});

describe('RISC-V', () => {
  const r = (name: string) => ({ type: 'reg' as const, index: parseRegister(name)! });

  it('names registers by their ABI name, and stores as one word', () => {
    const cpu = createRv32();
    writeRegister(cpu, parseRegister('a0')!, DATA_BASE);
    writeRegister(cpu, parseRegister('a1')!, 0x2a);
    const store: Rv32Instruction = {
      mnemonic: 'sw',
      operands: [r('a1'), { type: 'mem', base: parseRegister('a0')!, offset: 0 }]
    };
    const record = executeRv32(cpu, store, 0, [store]);
    expect(shown(rv32StepDiff(record, cpu))).toEqual([
      '[0x00010000] 00000000→0000002A',
      'pc 00000000→00000004'
    ]);
  });

  it('never counts x0 as written', () => {
    const cpu = createRv32();
    const add: Rv32Instruction = { mnemonic: 'add', operands: [r('zero'), r('a0'), r('a0')] };
    const record = executeRv32(cpu, add, null, []);
    expect(rv32RegisterChange(record, cpu, 0)).toBeNull();
  });

  it('marks a taken branch as a jump', () => {
    const cpu = createRv32();
    const program: Rv32Instruction[] = [
      { mnemonic: 'beq', operands: [r('zero'), r('zero'), { type: 'label', target: 2 }] },
      { mnemonic: 'add', operands: [r('a0'), r('a0'), r('a0')] },
      { mnemonic: 'add', operands: [r('a0'), r('a0'), r('a0')] }
    ];
    const record = executeRv32(cpu, program[0], 0, program);
    expect(shown(rv32StepDiff(record, cpu))).toEqual(['pc 00000000→00000008 jump']);
  });

  it('lists a store to a device at its address', () => {
    const cpu = createRv32();
    writeRegister(cpu, parseRegister('s0')!, RV32_DEVICES);
    writeRegister(cpu, parseRegister('t0')!, 0x81);
    const store: Rv32Instruction = {
      mnemonic: 'sb',
      operands: [r('t0'), { type: 'mem', base: parseRegister('s0')!, offset: PORTS.leds }]
    };
    const record = executeRv32(cpu, store, 0, [store]);
    expect(shown(rv32StepDiff(record, cpu))[0]).toBe('[0x10000010] 00→81');
  });
});

describe('the 6502', () => {
  it('lists A, the flags it changed and PC past the instruction', () => {
    const cpu = create6502();
    const program: Mos6502Instruction[] = [
      { mnemonic: 'lda', operands: [{ type: 'imm', value: 0x80 }] }
    ];
    const record = execute6502(cpu, program[0], 0, program);
    expect(shown(mos6502StepDiff(record, cpu))).toEqual(['A 00→80', 'N 0→1', 'PC 0600→0602']);
  });

  it('gives PC its jump, and a register its change', () => {
    const cpu = create6502();
    const program: Mos6502Instruction[] = [
      { mnemonic: 'ldx', operands: [{ type: 'imm', value: 1 }] },
      { mnemonic: 'jmp', operands: [{ type: 'label', target: 0 }] }
    ];
    const load = execute6502(cpu, program[0], 0, program);
    expect(mos6502RegisterChange(load, cpu, 'x')).toMatchObject({ before: '00', after: '01' });
    const jump = execute6502(cpu, program[1], 1, program);
    expect(mos6502RegisterChange(jump, cpu, 'pc')).toMatchObject({
      before: '0602',
      after: '0600',
      jump: true
    });
  });

  it('shows a store as the byte it replaced', () => {
    const cpu = create6502();
    const program: Mos6502Instruction[] = [
      { mnemonic: 'sta', operands: [{ type: 'abs', address: 0x0200, index: null }] }
    ];
    const record = execute6502(cpu, program[0], 0, program);
    expect(shown(mos6502StepDiff(record, cpu))[0]).toBe('[$0200] = 00');
  });

  it('lists a store to a device at its address', () => {
    const cpu = create6502();
    const program: Mos6502Instruction[] = [
      { mnemonic: 'lda', operands: [{ type: 'imm', value: 0x81 }] },
      { mnemonic: 'sta', operands: [{ type: 'abs', address: MOS6502_DEVICES, index: null }] }
    ];
    execute6502(cpu, program[0], 0, program);
    const record = execute6502(cpu, program[1], 1, program);
    expect(shown(mos6502StepDiff(record, cpu))[0]).toBe('[$D000] 00→81');
  });
});
