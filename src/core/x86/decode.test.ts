import { describe, expect, it } from 'vitest';
import { decode } from './decode';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { EXAMPLE_PROGRAMS } from './examples';
import type { RegisterName } from './registers';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

describe('decode', () => {
  it('names the kind and role of each operand', () => {
    const decoded = decode(line('add', reg('ax'), reg('cx')));

    expect(decoded).toMatchObject({
      mnemonic: 'add',
      category: 'arithmetic',
      size: 16,
      usesAlu: true,
      readsFlags: false,
      writesFlags: true
    });
    expect(decoded.operands).toEqual([
      { text: 'ax', kind: 'r16', role: 'destination' },
      { text: 'cx', kind: 'r16', role: 'source' }
    ]);
    expect(decoded.reads).toEqual(['ax', 'cx']);
    expect(decoded.writes).toEqual(['ax']);
    expect(decoded.memory).toEqual({ read: false, write: false });
  });

  it('reports 8-bit registers through the word register they live in', () => {
    const decoded = decode(line('mov', reg('ah'), reg('bl')));
    expect(decoded.size).toBe(8);
    expect(decoded.reads).toEqual(['bx']);
    expect(decoded.writes).toEqual(['ax']);
    expect(decoded.usesAlu).toBe(false);
    expect(decoded.writesFlags).toBe(false);
  });

  it('reads the address registers of a memory operand, and SS for [bp]', () => {
    const store = decode(
      line('mov', { type: 'mem', size: 16, base: 'bp', displacement: 2 }, imm(5))
    );
    expect(store.operands.map((operand) => operand.kind)).toEqual(['m16', 'imm16']);
    expect(store.reads).toEqual(['bp', 'ss']);
    expect(store.memory).toEqual({ read: false, write: true });

    const update = decode(line('inc', { type: 'mem', size: 8, base: 'bx', displacement: 0 }));
    expect(update.reads).toEqual(['bx', 'ds']);
    expect(update.memory).toEqual({ read: true, write: true });

    const compare = decode(
      line('cmp', { type: 'mem', size: 8, base: null, displacement: 0x10 }, imm(1))
    );
    expect(compare.reads).toEqual(['ds']);
    expect(compare.memory).toEqual({ read: true, write: false });
    expect(compare.operands[0].role).toBe('operand');
  });

  it('includes the registers the stack instructions use without naming', () => {
    const push = decode(line('push', reg('ax')));
    expect(push.operands[0].role).toBe('source');
    expect(push.reads).toEqual(['ax', 'sp', 'ss']);
    expect(push.writes).toEqual(['sp']);
    expect(push.memory).toEqual({ read: false, write: true });

    const pop = decode(line('pop', reg('bx')));
    expect(pop.reads).toEqual(['sp', 'ss']);
    expect(pop.writes).toEqual(['bx', 'sp']);
    expect(pop.memory).toEqual({ read: true, write: false });

    const ret = decode(line('ret'));
    expect(ret.size).toBeNull();
    expect(ret.writes).toEqual(['sp', 'ip']);
  });

  it('knows that MUL and DIV work on AX, and on DX for 16-bit operands', () => {
    expect(decode(line('mul', reg('bl')))).toMatchObject({ reads: ['ax', 'bx'], writes: ['ax'] });
    expect(decode(line('mul', reg('bx')))).toMatchObject({
      reads: ['ax', 'bx'],
      writes: ['ax', 'dx']
    });
    expect(decode(line('div', reg('cx')))).toMatchObject({
      reads: ['ax', 'cx', 'dx'],
      writes: ['ax', 'dx'],
      writesFlags: false
    });
  });

  it('tells conditional jumps, which read the flags, from the ones that do not', () => {
    const conditional = decode(line('je', label(3)));
    expect(conditional.operands).toEqual([{ text: 'L3', kind: 'label', role: 'target' }]);
    expect(conditional).toMatchObject({ readsFlags: true, writesFlags: false, writes: ['ip'] });

    expect(decode(line('jmp', label(0))).readsFlags).toBe(false);
    expect(decode(line('loop', label(0)))).toMatchObject({
      reads: ['cx'],
      writes: ['cx', 'ip'],
      readsFlags: false
    });
    expect(decode(line('loope', label(0))).readsFlags).toBe(true);
  });

  it('treats the second operand of a shift as its count', () => {
    const decoded = decode(line('shl', reg('al'), reg('cl')));
    expect(decoded.operands).toEqual([
      { text: 'al', kind: 'r8', role: 'destination' },
      { text: 'cl', kind: 'cl', role: 'count' }
    ]);
    expect(decoded.reads).toEqual(['ax', 'cx']);
    expect(decode(line('rcl', reg('al'), imm(1))).readsFlags).toBe(true);
  });

  it('knows which instructions use the ALU without touching the flags', () => {
    expect(decode(line('not', reg('ax')))).toMatchObject({ usesAlu: true, writesFlags: false });
    expect(decode(line('cmp', reg('ax'), imm(1)))).toMatchObject({ writes: [], writesFlags: true });
    expect(decode(line('stc'))).toMatchObject({ usesAlu: false, writesFlags: true });
    expect(decode(line('nop')).writesFlags).toBe(false);
  });

  it('decodes every line of the example programs', () => {
    for (const example of EXAMPLE_PROGRAMS) {
      for (const instruction of example.program) {
        expect(decode(instruction).operands).toHaveLength(instruction.operands.length);
      }
    }
  });

  it('knows the registers and memory the string instructions use without naming', () => {
    expect(decode(line('movsb'))).toMatchObject({
      size: 8,
      reads: ['si', 'di', 'ds', 'es'],
      writes: ['si', 'di'],
      memory: { read: true, write: true },
      readsFlags: true,
      writesFlags: false,
      usesAlu: false
    });
    expect(decode(line('lodsw'))).toMatchObject({
      size: 16,
      reads: ['si', 'ds'],
      writes: ['ax', 'si']
    });
    expect(decode(line('scasb'))).toMatchObject({
      reads: ['ax', 'di', 'es'],
      memory: { read: true, write: false },
      writesFlags: true,
      usesAlu: true
    });
  });

  it('adds CX to an instruction with a repeat prefix', () => {
    const decoded = decode({ prefix: 'rep', mnemonic: 'stosb', operands: [] });
    expect(decoded.reads).toEqual(['ax', 'cx', 'di', 'es']);
    expect(decoded.writes).toEqual(['cx', 'di']);
    expect(decoded.description).toBe('Repeat CX times: Store AL at ES:DI, then step DI');
  });

  it('decodes the port instructions, sizing OUT by its data and not by DX', () => {
    const output = decode(line('out', reg('dx'), reg('al')));
    expect(output).toMatchObject({ size: 8, reads: ['ax', 'dx'], writes: [], port: 'write' });
    expect(output.operands.map((operand) => operand.kind)).toEqual(['dx', 'al']);

    const input = decode(line('in', reg('ax'), imm(0x11)));
    expect(input).toMatchObject({ size: 16, reads: [], writes: ['ax'], port: 'read' });
    expect(decode(line('nop')).port).toBeNull();
  });

  it('tells the instructions that push onto the stack from the ones that pop', () => {
    expect(decode(line('push', reg('ax'))).stack).toBe('push');
    expect(decode(line('call', label(0))).stack).toBe('push');
    expect(decode(line('int', imm(0x21))).stack).toBe('push');
    expect(decode(line('pop', reg('ax'))).stack).toBe('pop');
    expect(decode(line('ret')).stack).toBe('pop');
    expect(decode(line('popf')).stack).toBe('pop');
    expect(decode(line('mov', reg('ax'), reg('bx'))).stack).toBeNull();
  });

  it('decodes the interrupt instructions', () => {
    const enter = decode(line('int', imm(0x21)));
    expect(enter.operands).toEqual([{ text: '0x21', kind: 'imm8', role: 'vector' }]);
    expect(enter).toMatchObject({
      reads: ['sp', 'cs', 'ss', 'ip'],
      writes: ['sp', 'cs', 'ip'],
      memory: { read: true, write: true },
      readsFlags: true,
      writesFlags: true
    });
    expect(decode(line('iret'))).toMatchObject({
      writes: ['sp', 'cs', 'ip'],
      memory: { read: true, write: false },
      writesFlags: true
    });
    expect(decode(line('pushf'))).toMatchObject({ readsFlags: true, writesFlags: false });
    expect(decode(line('popf')).writesFlags).toBe(true);
  });

  it('refuses an instruction whose operands do not form a legal instruction', () => {
    expect(() => decode(line('add', reg('ax')))).toThrow('Cannot decode');
    expect(() => decode(line('mov', reg('al'), reg('bx')))).toThrow('Cannot decode');
  });
});
