import { describe, expect, it } from 'vitest';
import { assemble, encode } from './encode';
import type { Instruction, Mnemonic, RepeatPrefix } from './instructions';
import type { MemoryBase, Operand } from './operands';
import { EXAMPLE_PROGRAMS } from './program';
import type { RegisterName } from './registers';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const mem = (size: 8 | 16, base: MemoryBase | null, displacement = 0): Operand => ({
  type: 'mem',
  size,
  base,
  displacement
});
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const repeated = (prefix: RepeatPrefix, mnemonic: Mnemonic): Instruction => ({
  prefix,
  mnemonic,
  operands: []
});

/** The bytes of one instruction as an assembler listing prints them: `89 D8`. */
function hex(instruction: Instruction): string {
  return encode(instruction)
    .encoding.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

describe('encode', () => {
  it('encodes MOV between registers, immediates and segment registers', () => {
    expect(hex(line('mov', reg('ax'), reg('bx')))).toBe('89 D8');
    expect(hex(line('mov', reg('cl'), reg('dh')))).toBe('88 F1');
    expect(hex(line('mov', reg('ax'), imm(0x1234)))).toBe('B8 34 12');
    expect(hex(line('mov', reg('al'), imm(0x7f)))).toBe('B0 7F');
    expect(hex(line('mov', reg('bx'), imm(-5)))).toBe('BB FB FF');
    expect(hex(line('mov', reg('ds'), reg('ax')))).toBe('8E D8');
    expect(hex(line('mov', reg('ax'), reg('es')))).toBe('8C C0');
  });

  it('encodes memory operands with the shortest displacement that fits', () => {
    expect(hex(line('mov', mem(16, 'bx'), imm(0x1234)))).toBe('C7 07 34 12');
    expect(hex(line('mov', mem(8, null, 0x24), imm(5)))).toBe('C6 06 24 00 05');
    expect(hex(line('mov', reg('cx'), mem(16, 'bp', 2)))).toBe('8B 4E 02');
    expect(hex(line('mov', reg('cx'), mem(16, 'bp')))).toBe('8B 4E 00');
    expect(hex(line('mov', mem(8, 'si'), reg('dl')))).toBe('88 14');
    expect(hex(line('mov', reg('dx'), mem(16, 'di', 0x100)))).toBe('8B 95 00 01');
    expect(hex(line('mov', reg('dx'), mem(16, 'bx', 0xfffe)))).toBe('8B 57 FE');
    expect(hex(line('mov', reg('bx'), mem(16, null, 0x10)))).toBe('8B 1E 10 00');
  });

  it('uses the short accumulator forms for direct addresses', () => {
    expect(hex(line('mov', reg('ax'), mem(16, null, 0x10)))).toBe('A1 10 00');
    expect(hex(line('mov', reg('al'), mem(8, null, 0x10)))).toBe('A0 10 00');
    expect(hex(line('mov', mem(16, null, 0x10), reg('ax')))).toBe('A3 10 00');
  });

  it('encodes the ALU instructions in all their forms', () => {
    expect(hex(line('add', reg('ax'), reg('bx')))).toBe('01 D8');
    expect(hex(line('sub', reg('ax'), reg('cx')))).toBe('29 C8');
    expect(hex(line('xor', reg('ax'), reg('ax')))).toBe('31 C0');
    expect(hex(line('add', reg('ax'), imm(5)))).toBe('83 C0 05');
    expect(hex(line('add', reg('ax'), imm(-1)))).toBe('83 C0 FF');
    expect(hex(line('add', reg('ax'), imm(0x1234)))).toBe('05 34 12');
    expect(hex(line('add', reg('bx'), imm(0x1234)))).toBe('81 C3 34 12');
    expect(hex(line('add', reg('al'), imm(5)))).toBe('04 05');
    expect(hex(line('add', reg('bl'), imm(5)))).toBe('80 C3 05');
    expect(hex(line('cmp', reg('al'), imm(10)))).toBe('3C 0A');
    expect(hex(line('and', mem(8, 'si'), imm(0x0f)))).toBe('80 24 0F');
    expect(hex(line('cmp', mem(16, 'di', 0x100), imm(1)))).toBe('83 BD 00 01 01');
    expect(hex(line('adc', reg('dx'), mem(16, 'bx')))).toBe('13 17');
    expect(hex(line('or', mem(16, 'bx'), reg('dx')))).toBe('09 17');
  });

  it('encodes one-operand arithmetic, shifts and TEST', () => {
    expect(hex(line('inc', reg('ax')))).toBe('40');
    expect(hex(line('dec', reg('cx')))).toBe('49');
    expect(hex(line('inc', reg('bl')))).toBe('FE C3');
    expect(hex(line('inc', mem(8, 'bx')))).toBe('FE 07');
    expect(hex(line('dec', mem(16, 'bx')))).toBe('FF 0F');
    expect(hex(line('neg', reg('ax')))).toBe('F7 D8');
    expect(hex(line('not', reg('al')))).toBe('F6 D0');
    expect(hex(line('mul', reg('bl')))).toBe('F6 E3');
    expect(hex(line('div', reg('cx')))).toBe('F7 F1');
    expect(hex(line('shl', reg('ax'), imm(1)))).toBe('D1 E0');
    expect(hex(line('shr', reg('al'), reg('cl')))).toBe('D2 E8');
    expect(hex(line('sar', reg('bx'), imm(1)))).toBe('D1 FB');
    expect(hex(line('rol', reg('al'), imm(1)))).toBe('D0 C0');
    expect(hex(line('test', reg('ax'), reg('bx')))).toBe('85 D8');
    expect(hex(line('test', reg('al'), imm(1)))).toBe('A8 01');
    expect(hex(line('test', reg('bl'), imm(1)))).toBe('F6 C3 01');
  });

  it('encodes the stack and exchange instructions', () => {
    expect(hex(line('push', reg('ax')))).toBe('50');
    expect(hex(line('push', reg('ds')))).toBe('1E');
    expect(hex(line('pop', reg('bx')))).toBe('5B');
    expect(hex(line('pop', reg('es')))).toBe('07');
    expect(hex(line('push', mem(16, 'bx')))).toBe('FF 37');
    expect(hex(line('pop', mem(16, 'si')))).toBe('8F 04');
    expect(hex(line('xchg', reg('ax'), reg('bx')))).toBe('93');
    expect(hex(line('xchg', reg('bx'), reg('cx')))).toBe('87 D9');
    expect(hex(line('xchg', reg('al'), reg('cl')))).toBe('86 C1');
    expect(hex(line('xchg', mem(16, 'bx'), reg('cx')))).toBe('87 0F');
    expect(hex(line('xchg', reg('al'), mem(8, 'bx')))).toBe('86 07');
  });

  it('encodes string, port, interrupt and flag instructions', () => {
    expect(hex(repeated('rep', 'stosb'))).toBe('F3 AA');
    expect(hex(repeated('repne', 'scasb'))).toBe('F2 AE');
    expect(hex(line('movsw'))).toBe('A5');
    expect(hex(line('in', reg('al'), imm(0x11)))).toBe('E4 11');
    expect(hex(line('in', reg('ax'), reg('dx')))).toBe('ED');
    expect(hex(line('out', imm(0x10), reg('al')))).toBe('E6 10');
    expect(hex(line('out', reg('dx'), reg('ax')))).toBe('EF');
    expect(hex(line('int', imm(0x21)))).toBe('CD 21');
    expect(hex(line('int', imm(3)))).toBe('CC');
    expect(hex(line('iret'))).toBe('CF');
    expect(hex(line('stc'))).toBe('F9');
    expect(hex(line('nop'))).toBe('90');
    expect(hex(line('ret'))).toBe('C3');
  });

  it('describes the three bit fields of a ModR/M byte', () => {
    const { fields } = encode(line('mov', reg('cx'), mem(16, 'bp', 2))).encoding;
    expect(fields.map((field) => field.kind)).toEqual(['opcode', 'modrm', 'displacement']);
    expect(fields[1].modrm).toMatchObject({
      mod: 0b01,
      reg: 0b001,
      rm: 0b110,
      regNote: '001 = CX',
      rmNote: '110 = [BP]'
    });

    const group = encode(line('sub', reg('bx'), imm(0x1234))).encoding.fields[1].modrm;
    expect(group?.regNote).toBe("101 = /5: picks SUB from this opcode's group");
  });
});

describe('assemble', () => {
  const bytes = (program: Instruction[]) =>
    assemble(program).lines.map((assembled) => assembled.encoding.bytes);

  it('gives every line its byte offset and measures jumps from the next instruction', () => {
    const { lines, size } = assemble([...EXAMPLE_PROGRAMS[0].program]);
    expect(lines.map((assembled) => assembled.offset)).toEqual([0, 3, 5, 7]);
    expect(size).toBe(9);
    // loop L2: the target is at 5 and the next instruction at 9, so the distance is -4.
    expect(lines[3].encoding.bytes).toEqual([0xe2, 0xfc]);
    expect(lines[3].encoding.fields[1].kind).toBe('relative');
  });

  it('encodes forward jumps, calls and a jump to the end of the program', () => {
    const [jump, call, , end] = bytes([
      line('jmp', label(2)),
      line('call', label(0)),
      line('nop'),
      line('je', label(4))
    ]);
    expect(jump).toEqual([0xeb, 0x03]);
    expect(call).toEqual([0xe8, 0xfb, 0xff]);
    expect(end).toEqual([0x74, 0x00]);
  });

  it('grows a JMP to its 16-bit form when the target is out of reach', () => {
    const filler = Array.from({ length: 50 }, () => line('mov', reg('ax'), imm(0x1234)));
    const { lines } = assemble([line('jmp', label(51)), ...filler, line('nop')]);
    expect(lines[0].encoding.bytes).toEqual([0xe9, 0x96, 0x00]);
    expect(lines[0].encoding.problem).toBeNull();
    expect(lines[51].offset).toBe(153);
  });

  it('reports a conditional jump that cannot reach its target', () => {
    const filler = Array.from({ length: 50 }, () => line('mov', reg('ax'), imm(0x1234)));
    const { lines } = assemble([line('je', label(51)), ...filler, line('nop')]);
    expect(lines[0].encoding.problem).toContain('Too far for a conditional jump');
  });

  it('stores a label used as a value as the byte offset of its line', () => {
    const [, , store] = bytes([line('nop'), line('nop'), line('mov', reg('bx'), label(1))]);
    expect(store).toEqual([0xbb, 0x01, 0x00]);
  });

  it('encodes every line of the example programs', () => {
    for (const example of EXAMPLE_PROGRAMS) {
      const { lines } = assemble([...example.program]);
      expect(lines.every((assembled) => assembled.encoding.bytes.length > 0)).toBe(true);
      expect(lines.every((assembled) => assembled.encoding.problem === null)).toBe(true);
    }
  });

  it('places a loose instruction after the program it would be added to', () => {
    const program = [...EXAMPLE_PROGRAMS[0].program];
    const added = encode(line('jmp', label(0)), program);
    expect(added.offset).toBe(9);
    expect(added.encoding.bytes).toEqual([0xeb, 0xf5]);
  });
});
