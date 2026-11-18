import type { Example } from '../shared/architecture';
import { PORTS } from '../shared/devices';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { expandPseudo, loadImmediate, type PseudoMnemonic } from './pseudo';
import { parseRegister } from './registers';

const reg = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number, base: string): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
/** A pseudo-instruction that stands for exactly one real instruction. */
const pseudo = (mnemonic: PseudoMnemonic, ...operands: Operand[]): Instruction =>
  expandPseudo({ mnemonic, operands })[0];
/** `li` written out as the instructions it expands to. */
const li = (name: string, value: number): Instruction[] =>
  loadImmediate(parseRegister(name)!, value);

/** s0 holds the address of the devices in the examples that use them. */
const devices = line('lui', reg('s0'), imm(0x10000));

export const EXAMPLE_PROGRAMS: Example<Instruction>[] = [
  {
    name: 'Sum 1..10',
    description:
      'No LOOP instruction: t0 counts down and BNEZ jumps back until it is 0; a0 ends up 55',
    program: [
      ...li('t0', 10),
      ...li('a0', 0),
      line('add', reg('a0'), reg('a0'), reg('t0')),
      line('addi', reg('t0'), reg('t0'), imm(-1)),
      pseudo('bnez', reg('t0'), label(2))
    ]
  },
  {
    name: 'Max of a0, a1',
    description: 'No flags: BGE compares the two registers itself; a2 ends up the larger value',
    program: [
      ...li('a0', -5),
      ...li('a1', 3),
      pseudo('mv', reg('a2'), reg('a0')),
      line('bge', reg('a0'), reg('a1'), label(5)),
      pseudo('mv', reg('a2'), reg('a1'))
    ]
  },
  {
    name: 'Call a function',
    description: 'JAL keeps the return address in ra, not on the stack; RET jumps back to it',
    program: [
      ...li('a0', 7),
      line('jal', reg('ra'), label(3)),
      pseudo('j', label(5)),
      line('slli', reg('a0'), reg('a0'), imm(1)),
      pseudo('ret')
    ]
  },
  {
    name: 'Swap through the stack',
    description: 'No PUSH or POP: move sp yourself, then store and load words; a0 and a1 swap',
    program: [
      ...li('a0', 0x111),
      ...li('a1', 0x222),
      line('addi', reg('sp'), reg('sp'), imm(-8)),
      line('sw', reg('a0'), at(0, 'sp')),
      line('sw', reg('a1'), at(4, 'sp')),
      line('lw', reg('a0'), at(4, 'sp')),
      line('lw', reg('a1'), at(0, 'sp')),
      line('addi', reg('sp'), reg('sp'), imm(8))
    ]
  },
  {
    name: 'Build 32-bit constants',
    description:
      'An immediate has 12 bits, so LI becomes LUI + ADDI. ADDI sign-extends, so 0x12345FFF needs LUI 0x12346',
    program: [...li('a0', 0x12345678), ...li('a1', 0x12345fff), ...li('a2', -1)]
  },
  {
    name: 'Fill and copy bytes',
    description:
      'No string instructions: loops of SB and LBU fill 8 bytes at 0x10000, then copy them to 0x10010',
    program: [
      line('lui', reg('a0'), imm(0x10)),
      line('addi', reg('a1'), reg('a0'), imm(0x10)),
      ...li('t1', 0x2a),
      ...li('t0', 8),
      pseudo('mv', reg('t2'), reg('a0')),
      line('sb', reg('t1'), at(0, 't2')),
      line('addi', reg('t2'), reg('t2'), imm(1)),
      line('addi', reg('t0'), reg('t0'), imm(-1)),
      pseudo('bnez', reg('t0'), label(5)),
      ...li('t0', 8),
      line('lbu', reg('t1'), at(0, 'a0')),
      line('sb', reg('t1'), at(0, 'a1')),
      line('addi', reg('a0'), reg('a0'), imm(1)),
      line('addi', reg('a1'), reg('a1'), imm(1)),
      line('addi', reg('t0'), reg('t0'), imm(-1)),
      pseudo('bnez', reg('t0'), label(10))
    ]
  },
  {
    name: 'Running light',
    description: 'No OUT: the LEDs are memory at 0x10000010, so SB lights them, one bit at a time',
    program: [
      devices,
      ...li('t0', 1),
      ...li('t1', 8),
      line('sb', reg('t0'), at(PORTS.leds, 's0')),
      line('slli', reg('t0'), reg('t0'), imm(1)),
      line('addi', reg('t1'), reg('t1'), imm(-1)),
      pseudo('bnez', reg('t1'), label(3))
    ]
  },
  {
    name: 'Switches, digits and terminal',
    description:
      'LBU reads the switches at 0x10000011; SB copies them to the LEDs and a digit, then prints HI',
    program: [
      devices,
      line('lbu', reg('t0'), at(PORTS.switches, 's0')),
      line('sb', reg('t0'), at(PORTS.leds, 's0')),
      line('sb', reg('t0'), at(PORTS.digits, 's0')),
      ...li('t1', 0x48),
      line('sb', reg('t1'), at(PORTS.terminal, 's0')),
      ...li('t1', 0x49),
      line('sb', reg('t1'), at(PORTS.terminal, 's0'))
    ]
  },
  {
    name: 'Multiply and divide',
    description: 'The M extension; dividing by zero does not trap, it gives all ones (-1)',
    program: [
      ...li('a0', 7),
      ...li('a1', -3),
      line('mul', reg('a2'), reg('a0'), reg('a1')),
      line('div', reg('a3'), reg('a0'), reg('a1')),
      line('rem', reg('a4'), reg('a0'), reg('a1')),
      line('div', reg('a5'), reg('a0'), reg('zero'))
    ]
  }
];
