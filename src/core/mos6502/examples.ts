import type { Example } from '../shared/architecture';
import { PORTS } from '../shared/devices';
import type { Instruction, Mnemonic } from './instructions';
import type { Index, Operand } from './operands';
import { DEVICE_BASE } from './state';

const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number, index: Index | null = null): Operand => ({
  type: 'zp',
  address,
  index
});
const abs = (address: number, index: Index | null = null): Operand => ({
  type: 'abs',
  address,
  index
});
const izy = (address: number): Operand => ({ type: 'izy', address });
const label = (target: number): Operand => ({ type: 'label', target });
const A: Operand = { type: 'acc' };
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const device = (port: number): Operand => abs(DEVICE_BASE + port);

export const EXAMPLE_PROGRAMS: Example<Instruction>[] = [
  {
    id: 'sum',
    name: 'Sum 1..10',
    description:
      'Only A can add, and only memory to it: X goes through the zero page. A ends up 55',
    program: [
      line('lda', imm(0)),
      line('ldx', imm(10)),
      line('stx', zp(0x00)),
      line('clc'),
      line('adc', zp(0x00)),
      line('dex'),
      line('bne', label(2))
    ]
  },
  {
    id: 'wide-add',
    name: 'Add 16-bit numbers',
    description:
      'An 8-bit CPU adds a word one byte at a time; C carries into the high byte. $1234 + $00FF = $1333',
    program: [
      line('clc'),
      line('lda', imm(0x34)),
      line('adc', imm(0xff)),
      line('sta', zp(0x00)),
      line('lda', imm(0x12)),
      line('adc', imm(0x00)),
      line('sta', zp(0x01))
    ]
  },
  {
    id: 'multiply',
    name: 'Multiply by shifting',
    description:
      'No MUL: shift the multiplier right, add on each 1 bit, 8 times. 6 × 7 = 42 lands in $01',
    program: [
      line('lda', imm(6)),
      line('sta', zp(0x00)),
      line('lda', imm(7)),
      line('sta', zp(0x01)),
      line('lda', imm(0)),
      line('ldx', imm(8)),
      line('lsr', zp(0x01)),
      line('bcc', label(10)),
      line('clc'),
      line('adc', zp(0x00)),
      line('ror', A),
      line('ror', zp(0x01)),
      line('dex'),
      line('bne', label(7))
    ]
  },
  {
    id: 'call',
    name: 'Call a subroutine',
    description:
      'JSR pushes the address of its own last byte; RTS pulls it and adds 1. A ends up 14',
    program: [
      line('lda', imm(7)),
      line('jsr', label(3)),
      line('jmp', label(5)),
      line('asl', A),
      line('rts')
    ]
  },
  {
    id: 'pointer',
    name: 'A pointer in the zero page',
    description:
      '($10),Y: the address is the pointer in $10 and $11, plus Y. Fills 8 bytes at $0300',
    program: [
      line('lda', imm(0x00)),
      line('sta', zp(0x10)),
      line('lda', imm(0x03)),
      line('sta', zp(0x11)),
      line('ldy', imm(0)),
      line('lda', imm(0x2a)),
      line('sta', izy(0x10)),
      line('iny'),
      line('cpy', imm(8)),
      line('bne', label(6))
    ]
  },
  {
    id: 'running-light',
    name: 'Running light',
    description:
      'No OUT: the LEDs are memory at $D010. ASL moves the bit until it falls out into C',
    program: [
      line('lda', imm(1)),
      line('sta', device(PORTS.leds)),
      line('asl', A),
      line('bne', label(1))
    ]
  },
  {
    id: 'switches',
    name: 'Switches, digits and terminal',
    description:
      'LDA reads the switches at $D011; STA copies them to the LEDs and a digit, then prints HI',
    program: [
      line('lda', device(PORTS.switches)),
      line('sta', device(PORTS.leds)),
      line('sta', device(PORTS.digits)),
      line('lda', imm(0x48)),
      line('sta', device(PORTS.terminal)),
      line('lda', imm(0x49)),
      line('sta', device(PORTS.terminal))
    ]
  },
  {
    id: 'decimal',
    name: 'Decimal mode',
    description:
      'With D set, ADC adds decimal digits (BCD): $19 + $01 = $20, and $99 + $01 = $00 with C set',
    program: [
      line('sed'),
      line('clc'),
      line('lda', imm(0x19)),
      line('adc', imm(0x01)),
      line('sta', zp(0x00)),
      line('lda', imm(0x99)),
      line('adc', imm(0x01)),
      line('cld')
    ]
  }
];
