import { describe, expect, it } from 'vitest';
import { execute as run6502 } from '@/core/mos6502/execute';
import type { Instruction as Line6502 } from '@/core/mos6502/instructions';
import { createCpuState as create6502 } from '@/core/mos6502/state';
import { storedBytes } from '@/core/representation/bytes';
import { execute as runRv32 } from '@/core/rv32/execute';
import type { Instruction as LineRv32 } from '@/core/rv32/instructions';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState as createRv32, writeRegister as writeRv32 } from '@/core/rv32/state';
import { execute as runX86 } from '@/core/x86/execute';
import { createCpuState as createX86, physicalAddress } from '@/core/x86/state';
import { byteCells, misreadText, orderLesson } from './numbersBytes';

describe('byteCells', () => {
  it('lists the low byte first, as the CPUs here store a value', () => {
    expect(byteCells(0x1234, 16, 'little')).toEqual([
      { address: 'n', hex: '34', bits: 'bits 7–0', low: true },
      { address: 'n + 1', hex: '12', bits: 'bits 15–8', low: false }
    ]);
  });

  it('lists the high byte first the other way', () => {
    const cells = byteCells(0x89abcdef, 32, 'big');
    expect(cells.map((cell) => cell.hex)).toEqual(['89', 'AB', 'CD', 'EF']);
    expect(cells.map((cell) => cell.bits)).toEqual([
      'bits 31–24',
      'bits 23–16',
      'bits 15–8',
      'bits 7–0'
    ]);
    expect(cells.map((cell) => cell.address)).toEqual(['n', 'n + 1', 'n + 2', 'n + 3']);
    expect(cells.map((cell) => cell.low)).toEqual([false, false, false, true]);
  });

  it('has one cell for a byte', () => {
    expect(byteCells(0x5a, 8, 'little')).toEqual(byteCells(0x5a, 8, 'big'));
    expect(byteCells(0x5a, 8, 'little')).toHaveLength(1);
  });
});

describe('misreadText', () => {
  it('gives the number the bytes spell the other way round', () => {
    expect(misreadText(0x1234, 16)).toBe(
      'Read in the other order, the same bytes are 0x3412: 13,330 and not 4,660.'
    );
  });

  it('says when the order makes no difference', () => {
    expect(misreadText(0x4242, 16)).toBe('These bytes read the same in either order.');
  });
});

describe('orderLesson', () => {
  it('says which order the CPUs here use', () => {
    expect(orderLesson('little')).toContain('little end first');
    expect(orderLesson('big')).toContain('None of the three CPUs');
  });
});

describe('the CPUs store the low byte first', () => {
  it('8086: a word moved to memory', () => {
    const cpu = createX86();
    cpu.registers.ax = 0x1234;
    runX86(cpu, {
      mnemonic: 'mov',
      operands: [
        { type: 'mem', size: 16, base: null, displacement: 0x40 },
        { type: 'reg', name: 'ax' }
      ]
    });
    const at = physicalAddress(cpu.registers.ds, 0x40);
    expect([...cpu.memory.slice(at, at + 2)]).toEqual(storedBytes(0x1234, 16, 'little'));
  });

  it('RISC-V: a word stored with sw', () => {
    const cpu = createRv32();
    const a1 = parseRegister('a1')!;
    const a2 = parseRegister('a2')!;
    writeRv32(cpu, a1, 0x100);
    writeRv32(cpu, a2, 0x89abcdef);
    const store: LineRv32 = {
      mnemonic: 'sw',
      operands: [
        { type: 'reg', index: a2 },
        { type: 'mem', base: a1, offset: 0 }
      ]
    };
    runRv32(cpu, store, null, [store]);
    expect([...cpu.memory.slice(0x100, 0x104)]).toEqual(storedBytes(0x89abcdef, 32, 'little'));
  });

  it('6502: the return address JSR leaves on the stack', () => {
    const cpu = create6502();
    const program: Line6502[] = [
      { mnemonic: 'jsr', operands: [{ type: 'label', target: 1 }] },
      { mnemonic: 'nop', operands: [] }
    ];
    run6502(cpu, program[0], 0, program);
    // JSR pushes the address of its own last byte, $0602: high byte first, on a stack that
    // grows down, so the low byte ends up at the lower address.
    expect([...cpu.memory.slice(0x1fe, 0x200)]).toEqual(storedBytes(0x0602, 16, 'little'));
  });
});
