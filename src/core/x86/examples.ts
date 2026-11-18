import type { Example } from '../shared/architecture';
import { PORTS } from '../shared/devices';
import { VECTOR_SIZE } from './executionContext';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';

const reg = (name: Extract<Operand, { type: 'reg' }>['name']): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const port = imm;
const rep = (mnemonic: Mnemonic): Instruction => ({ prefix: 'rep', mnemonic, operands: [] });

export const EXAMPLE_PROGRAMS: Example<Instruction>[] = [
  {
    name: 'Sum 1..10',
    description: 'LOOP counts CX down; AX ends up as 55',
    program: [
      line('mov', reg('cx'), imm(10)),
      line('xor', reg('ax'), reg('ax')),
      line('add', reg('ax'), reg('cx')),
      line('loop', label(2))
    ]
  },
  {
    name: 'Max of AX, BX',
    description: 'CMP + a signed conditional jump; DX ends up as the larger value',
    program: [
      line('mov', reg('ax'), imm(-5)),
      line('mov', reg('bx'), imm(3)),
      line('mov', reg('dx'), reg('ax')),
      line('cmp', reg('ax'), reg('bx')),
      line('jge', label(6)),
      line('mov', reg('dx'), reg('bx')),
      line('nop')
    ]
  },
  {
    name: 'Call a subroutine',
    description: 'CALL pushes the return line, RET pops it back into IP',
    program: [
      line('mov', reg('ax'), imm(7)),
      line('call', label(3)),
      line('jmp', label(5)),
      line('shl', reg('ax'), imm(1)),
      line('ret'),
      line('nop')
    ]
  },
  {
    name: 'Swap with the stack',
    description: 'PUSH/POP in reverse order swaps AX and BX',
    program: [
      line('mov', reg('ax'), imm(0x1111)),
      line('mov', reg('bx'), imm(0x2222)),
      line('push', reg('ax')),
      line('push', reg('bx')),
      line('pop', reg('ax')),
      line('pop', reg('bx'))
    ]
  },
  {
    name: 'Fill and copy a string',
    description: 'REP STOSB fills 8 bytes at DS:0000, REP MOVSB copies them to DS:0010',
    program: [
      line('mov', reg('al'), imm(0x2a)),
      line('mov', reg('di'), imm(0)),
      line('mov', reg('cx'), imm(8)),
      rep('stosb'),
      line('mov', reg('si'), imm(0)),
      line('mov', reg('di'), imm(0x10)),
      line('mov', reg('cx'), imm(8)),
      rep('movsb')
    ]
  },
  {
    name: 'Running light',
    description: 'OUT sends a single 1 bit to the LEDs on port 10h, shifted left 8 times',
    program: [
      line('mov', reg('al'), imm(1)),
      line('mov', reg('cx'), imm(8)),
      line('out', port(PORTS.leds), reg('al')),
      line('shl', reg('al'), imm(1)),
      line('loop', label(2))
    ]
  },
  {
    name: 'Switches, digits and terminal',
    description: 'IN reads the switches; OUT copies them to the LEDs and a digit, then prints HI',
    program: [
      line('in', reg('al'), port(PORTS.switches)),
      line('out', port(PORTS.leds), reg('al')),
      line('out', port(PORTS.digits), reg('al')),
      line('mov', reg('al'), imm(0x48)),
      line('out', port(PORTS.terminal), reg('al')),
      line('mov', reg('al'), imm(0x49)),
      line('out', port(PORTS.terminal), reg('al'))
    ]
  },
  {
    name: 'Software interrupt',
    description: 'Installs a handler in vector 21h, then INT 21h prints AL on the terminal twice',
    program: [
      line('xor', reg('ax'), reg('ax')),
      line('mov', reg('ds'), reg('ax')),
      line(
        'mov',
        { type: 'mem', size: 16, base: null, displacement: 0x21 * VECTOR_SIZE },
        label(8)
      ),
      line('mov', reg('al'), imm(0x41)),
      line('int', imm(0x21)),
      line('mov', reg('al'), imm(0x42)),
      line('int', imm(0x21)),
      line('jmp', label(10)),
      line('out', port(PORTS.terminal), reg('al')),
      line('iret')
    ]
  }
];
